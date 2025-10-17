import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tournamentId } = body || {};
    if (!tournamentId) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return NextResponse.json({ error: "tournament not found" }, { status: 404 });
    if (t.opLinked) return NextResponse.json({ error: "linked tournament is read-only" }, { status: 403 });

    await prisma.match.updateMany({ where: { tournamentId }, data: { sideAId: null, sideBId: null } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
