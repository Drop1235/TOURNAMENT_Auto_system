import { prisma } from "./prisma";

type InitParticipant = { id: string; name: string; seed: number };

type BracketData = {
  tournament: {
    id: string;
    name: string;
    size: number;
    category: string;
    year: number;
    opLinked: boolean;
    challongeTournamentId: string | null;
    createdAt: Date;
  };
  participants: { id: string; no: number; name: string; seed: number; club: string | null }[];
  rounds: { index: number; name: string }[];
  matches: {
    id: string;
    roundIndex: number;
    roundName: string;
    sideAId: string | null;
    sideBId: string | null;
    scoreA: string | null;
    scoreB: string | null;
    winnerId: string | null;
    nextMatchId: string | null;
    winnerToSide: string | null;
    scheduledAt: Date | null;
    court: string | null;
  }[];
};

function roundNameFrom(size: number, roundIndex: number) {
  const totalRounds = Math.max(1, Math.log2(Math.max(2, size)));
  const fromFinal = totalRounds - roundIndex - 1;
  if (fromFinal <= 0) return "F";
  if (fromFinal === 1) return "SF";
  if (fromFinal === 2) return "QF";
  const pow = 2 ** fromFinal;
  return `R${pow}`;
}

function pairingsBySeed(participants: InitParticipant[]) {
  const seeds = [...participants].sort((a, b) => a.seed - b.seed);
  const n = seeds.length;
  const pairs: [InitParticipant | null, InitParticipant | null][] = [];
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = seeds[i] ?? null;
    const b = seeds[n - 1 - i] ?? null;
    pairs.push([a, b]);
  }
  return pairs;
}

function parseScoreTotal(score: string | null | undefined) {
  if (!score) return { a: 0, b: 0 };
  const sets = score.split(",").map((s) => s.trim()).filter(Boolean);
  let a = 0;
  let b = 0;
  for (const set of sets) {
    const m = set.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) continue;
    a += Number(m[1]);
    b += Number(m[2]);
  }
  return { a, b };
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureTournament(tournamentId: string, name: string, size: number, categoryInput?: string) {
  const year = new Date().getFullYear();
  const category = (categoryInput && categoryInput.trim()) ? categoryInput.trim() : "General";
  const uid = `${slugify(name)}_${slugify(category)}_${year}`;
  const t = await prisma.tournament.upsert({
    where: { id: tournamentId },
    update: { name, size, category, year, uid },
    create: { id: tournamentId, name, size, category, year, uid, opLinked: false },
  });
  return t;
}

async function upsertParticipants(tournamentId: string, participants: InitParticipant[]) {
  const ops = participants.map((p, idx) =>
    prisma.participant.upsert({
      where: { id: p.id },
      update: { name: p.name, seed: p.seed, no: p.seed || idx + 1, tournamentId },
      create: { id: p.id, name: p.name, seed: p.seed, no: p.seed || idx + 1, tournamentId },
    })
  );
  await Promise.all(ops);
  const all = await prisma.participant.findMany({ where: { tournamentId }, orderBy: { seed: "asc" } });
  return all;
}

async function createSingleElimMatches(tournamentId: string, participants: InitParticipant[]) {
  const size = participants.length;
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, size))));
  const roundMatches: string[][] = [];
  for (let r = 0; r < totalRounds; r++) roundMatches.push([]);

  const pairs = pairingsBySeed(participants);
  const firstRoundIds: string[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const rIndex = 0;
    const rName = roundNameFrom(size, rIndex);
    const m = await prisma.match.create({
      data: {
        roundIndex: rIndex,
        roundName: rName,
        tournamentId,
      },
    });
    roundMatches[rIndex].push(m.id);
    firstRoundIds.push(m.id);
  }

  for (let r = 1; r < totalRounds; r++) {
    const count = Math.ceil(firstRoundIds.length / 2 ** r);
    for (let i = 0; i < count; i++) {
      const rName = roundNameFrom(size, r);
      const m = await prisma.match.create({
        data: { roundIndex: r, roundName: rName, tournamentId },
      });
      roundMatches[r].push(m.id);
    }
  }

  for (let r = 0; r < totalRounds - 1; r++) {
    const current = roundMatches[r];
    const next = roundMatches[r + 1];
    for (let i = 0; i < current.length; i++) {
      const matchId = current[i];
      const nextMatchId = next[Math.floor(i / 2)] ?? null;
      const winnerToSide = i % 2 === 0 ? "A" : "B";
      await prisma.match.update({ where: { id: matchId }, data: { nextMatchId, winnerToSide } });
    }
  }

  // BYE処理はD&D配置後に行うため、ここでは保留
}

async function setMatchWinnerByBye(matchId: string, winnerId: string) {
  const m = await prisma.match.update({ where: { id: matchId }, data: { winnerId } });
  if (m.nextMatchId && m.winnerToSide) {
    if (m.winnerToSide === "A") {
      await prisma.match.update({ where: { id: m.nextMatchId }, data: { sideAId: winnerId } });
    } else if (m.winnerToSide === "B") {
      await prisma.match.update({ where: { id: m.nextMatchId }, data: { sideBId: winnerId } });
    }
  }
}

export async function initSingleElim(
  tournamentId: string,
  participants: InitParticipant[],
  tournamentName: string,
  category?: string
) {
  const valid = participants.filter((p) => !!p && typeof p.seed === "number");
  const size = valid.length;
  await ensureTournament(tournamentId, tournamentName, size, category);
  await upsertParticipants(tournamentId, valid);
  await createSingleElimMatches(tournamentId, valid);
}

export async function updateMatchScore(matchId: string, scoreA: string, scoreB: string) {
  const totalsA = parseScoreTotal(scoreA);
  const totalsB = parseScoreTotal(scoreB);
  const a = totalsA.a;
  const b = totalsB.b;
  let winnerId: string | null = null;
  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (!m) return;
  const sideA = m.sideAId;
  const sideB = m.sideBId;
  if (sideA || sideB) {
    if ((a || 0) > (b || 0)) winnerId = sideA ?? null;
    else if ((b || 0) > (a || 0)) winnerId = sideB ?? null;
    else winnerId = sideA ?? null;
  }
  const updated = await prisma.match.update({ where: { id: matchId }, data: { scoreA, scoreB, winnerId } });
  if (updated.nextMatchId && updated.winnerToSide && winnerId) {
    if (updated.winnerToSide === "A") {
      await prisma.match.update({ where: { id: updated.nextMatchId }, data: { sideAId: winnerId } });
    } else if (updated.winnerToSide === "B") {
      await prisma.match.update({ where: { id: updated.nextMatchId }, data: { sideBId: winnerId } });
    }
  }
}

export async function getBracket(tournamentId: string): Promise<BracketData> {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new Error("tournament not found");
  const participants = await prisma.participant.findMany({ where: { tournamentId }, orderBy: { seed: "asc" } });
  const matches = await prisma.match.findMany({ where: { tournamentId } });
  const roundSet = new Map<number, string>();
  for (const m of matches) {
    roundSet.set(m.roundIndex, m.roundName);
  }
  const rounds = Array.from(roundSet.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, name]) => ({ index, name }));
  return {
    tournament: {
      id: t.id,
      name: t.name,
      size: t.size,
      category: t.category,
      year: t.year,
      opLinked: t.opLinked,
      challongeTournamentId: t.challongeTournamentId ?? null,
      createdAt: t.createdAt,
    },
    participants: participants.map((p) => ({ id: p.id, no: p.no, name: p.name, seed: p.seed ?? 0, club: p.club ?? null })),
    rounds,
    matches: matches.map((m) => ({
      id: m.id,
      roundIndex: m.roundIndex,
      roundName: m.roundName,
      sideAId: m.sideAId,
      sideBId: m.sideBId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerId: m.winnerId,
      nextMatchId: m.nextMatchId,
      winnerToSide: m.winnerToSide,
      scheduledAt: m.scheduledAt,
      court: m.court,
    })),
  };
}
