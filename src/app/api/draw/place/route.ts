import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tournamentId, matchId, side, participantId } = body || {};
    if (!tournamentId || !matchId || !participantId || (side !== "A" && side !== "B")) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return NextResponse.json({ error: "tournament not found" }, { status: 404 });
    if (t.opLinked) return NextResponse.json({ error: "linked tournament is read-only" }, { status: 403 });

    // Remove participant from any existing match in this tournament first
    await prisma.match.updateMany({ where: { tournamentId, sideAId: participantId }, data: { sideAId: null } });
    await prisma.match.updateMany({ where: { tournamentId, sideBId: participantId }, data: { sideBId: null } });

    // Place into target match/side
    const data = side === "A" ? { sideAId: participantId } : { sideBId: participantId };
    await prisma.match.update({ where: { id: matchId }, data });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
