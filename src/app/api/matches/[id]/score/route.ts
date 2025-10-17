import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateMatchScore } from "@/lib/brackets";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params?.id;
    if (!matchId) {
      return NextResponse.json({ error: "match id is required" }, { status: 400 });
    }
    const body = await req.json();
    const scoreA: string = body?.scoreA ?? "";
    const scoreB: string = body?.scoreB ?? "";

    await updateMatchScore(matchId, scoreA, scoreB);

    const updated = await prisma.match.findUnique({ where: { id: matchId } });
    if (!updated) return NextResponse.json({ error: "match not found after update" }, { status: 404 });

    const next = updated.nextMatchId
      ? await prisma.match.findUnique({ where: { id: updated.nextMatchId } })
      : null;

    return NextResponse.json({ match: updated, nextMatch: next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
