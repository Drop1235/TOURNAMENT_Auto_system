import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTournament } from "@/lib/challonge";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name: string = body?.name;
    const tournamentId: string = body?.tournamentId;

    if (!name || !tournamentId) {
      return NextResponse.json({ error: "name and tournamentId are required" }, { status: 400 });
    }

    const local = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!local) return NextResponse.json({ error: "local tournament not found" }, { status: 404 });

    const created = await createTournament(name);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { challongeTournamentId: String(created.id) },
    });

    return NextResponse.json({ challongeTournamentId: String(created.id) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
