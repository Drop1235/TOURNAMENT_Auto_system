import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkAddParticipants } from "@/lib/challonge";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tournamentId: string = body?.tournamentId;
    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 });
    }

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return NextResponse.json({ error: "local tournament not found" }, { status: 404 });
    if (!t.challongeTournamentId) {
      return NextResponse.json({ error: "challonge tournament not linked" }, { status: 400 });
    }

    const participants = await prisma.participant.findMany({
      where: { tournamentId },
      orderBy: { seed: "asc" },
    });

    const names = participants.map((p) => p.name);
    const created = await bulkAddParticipants(t.challongeTournamentId, names);

    // Map by order for initial simple implementation
    const updates = participants.map((p, idx) => {
      const ch = created[idx]?.participant;
      if (!ch) return null;
      return prisma.participant.update({
        where: { id: p.id },
        data: { challongeParticipantId: ch.id },
      });
    }).filter(Boolean) as any[];

    await prisma.$transaction(updates);

    return NextResponse.json({ count: updates.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
