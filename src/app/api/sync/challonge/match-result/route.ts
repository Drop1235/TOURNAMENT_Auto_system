import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMatches, putMatchResult } from "@/lib/challonge";

function invertScoresCsv(csv: string): string {
  const parts = csv.split(",").map((s) => s.trim()).filter(Boolean);
  const inv = parts.map((p) => {
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return p;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return `${b}-${a}`;
  });
  return inv.join(",");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tournamentId: string = body?.tournamentId;
    const localMatchId: string = body?.localMatchId;

    if (!tournamentId || !localMatchId) {
      return NextResponse.json({ error: "tournamentId and localMatchId are required" }, { status: 400 });
    }

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return NextResponse.json({ error: "local tournament not found" }, { status: 404 });
    if (!t.challongeTournamentId) return NextResponse.json({ error: "challonge tournament not linked" }, { status: 400 });

    // Ensure mapping between local matches and Challonge matches (simple round + order mapping)
    const localMatches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }],
    });

    const needMapping = localMatches.some((m) => m.challongeMatchId == null);
    if (needMapping) {
      const ch = await listMatches(t.challongeTournamentId);
      const challongeMatches = ch.map((x) => x.match);
      challongeMatches.sort((a: any, b: any) => {
        const ra = Number(a.round ?? 0);
        const rb = Number(b.round ?? 0);
        if (ra !== rb) return ra - rb;
        return Number(a.id) - Number(b.id);
      });
      const updates = [] as any[];
      const count = Math.min(localMatches.length, challongeMatches.length);
      for (let i = 0; i < count; i++) {
        const lm = localMatches[i];
        const cm = challongeMatches[i];
        if (lm.challongeMatchId == null) {
          updates.push(
            prisma.match.update({ where: { id: lm.id }, data: { challongeMatchId: Number(cm.id) } })
          );
        }
      }
      if (updates.length) await prisma.$transaction(updates);
    }

    const m = await prisma.match.findUnique({ where: { id: localMatchId } });
    if (!m) return NextResponse.json({ error: "local match not found" }, { status: 404 });
    if (m.challongeMatchId == null) return NextResponse.json({ error: "challonge match mapping missing" }, { status: 400 });

    // Build scores_csv (minimal): prefer scoreA as canonical csv; if absent but scoreB exists, invert it
    let scoresCsv = "";
    if (m.scoreA && m.scoreA.trim()) scoresCsv = m.scoreA.trim();
    else if (m.scoreB && m.scoreB.trim()) scoresCsv = invertScoresCsv(m.scoreB.trim());
    else return NextResponse.json({ error: "scores not set locally" }, { status: 400 });

    // Winner mapping
    if (!m.winnerId) return NextResponse.json({ error: "winner not decided locally" }, { status: 400 });
    const winner = await prisma.participant.findUnique({ where: { id: m.winnerId } });
    if (!winner || winner.challongeParticipantId == null) {
      return NextResponse.json({ error: "winner not synced to Challonge (missing challongeParticipantId)" }, { status: 400 });
    }

    const result = await putMatchResult(
      t.challongeTournamentId,
      Number(m.challongeMatchId),
      scoresCsv,
      Number(winner.challongeParticipantId)
    );

    const next = m.nextMatchId ? await prisma.match.findUnique({ where: { id: m.nextMatchId } }) : null;

    return NextResponse.json({ ok: true, challonge: result, match: m, nextMatch: next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
