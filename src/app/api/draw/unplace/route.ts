import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tournamentId, matchId, side } = body || {};
    if (!tournamentId || !matchId || (side !== "A" && side !== "B")) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return NextResponse.json({ error: "tournament not found" }, { status: 404 });
    if (t.opLinked) return NextResponse.json({ error: "linked tournament is read-only" }, { status: 403 });

    const data = side === "A" ? { sideAId: null } : { sideBId: null };
    await prisma.match.update({ where: { id: matchId }, data });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
