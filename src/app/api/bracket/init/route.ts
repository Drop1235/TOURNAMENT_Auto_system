import { NextResponse } from "next/server";
import cuid from "cuid";
import { initSingleElim } from "@/lib/brackets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tournamentName: string = body?.tournamentName;
    const category: string | undefined = body?.category;
    const gameFormat: string | undefined = body?.gameFormat;
    const participants: { id: string; name: string; seed: number }[] = body?.participants ?? [];

    if (!tournamentName || !Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const tournamentId = cuid();
    await initSingleElim(tournamentId, participants, tournamentName, category, gameFormat);

    return NextResponse.json({ tournamentId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
