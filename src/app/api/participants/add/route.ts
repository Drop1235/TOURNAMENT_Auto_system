import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tournamentId, name, no, seed, club } = body || {};
    if (!tournamentId || !name || typeof name !== "string") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return NextResponse.json({ error: "tournament not found" }, { status: 404 });
    if (t.opLinked) return NextResponse.json({ error: "linked tournament is read-only" }, { status: 403 });

    const count = await prisma.participant.count({ where: { tournamentId } });
    const created = await prisma.participant.create({
      data: {
        name,
        no: typeof no === "number" && Number.isFinite(no) ? no : count + 1,
        seed: typeof seed === "number" && Number.isFinite(seed) ? seed : null,
        club: club ?? null,
        tournamentId,
      },
      select: { id: true, name: true, no: true, seed: true },
    });
    return NextResponse.json({ participant: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
