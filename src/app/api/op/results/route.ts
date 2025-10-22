import { NextResponse } from "next/server";
import { updateMatchScore } from "@/lib/brackets";

function setsToScores(sets: Array<{ a: number; b: number }>): { scoreA: string; scoreB: string } {
  const partsA: string[] = [];
  const partsB: string[] = [];
  for (const s of sets || []) {
    const a = typeof s.a === "number" ? s.a : 0;
    const b = typeof s.b === "number" ? s.b : 0;
    partsA.push(String(a));
    partsB.push(String(b));
  }
  return { scoreA: partsA.join(","), scoreB: partsB.join(",") };
}

export async function POST(req: Request) {
  try {
    const secret = process.env.OP_WEBHOOK_SECRET || "";
    const header = req.headers.get("x-op-secret") || req.headers.get("X-OP-SECRET") || "";
    if (!secret || !header || header !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const matchId: string = body?.matchId;
    let scoreA: string = body?.scoreA ?? "";
    let scoreB: string = body?.scoreB ?? "";
    const sets: Array<{ a: number; b: number }> | undefined = body?.sets;

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    if ((!scoreA || !scoreB) && Array.isArray(sets) && sets.length > 0) {
      const conv = setsToScores(sets);
      scoreA = conv.scoreA;
      scoreB = conv.scoreB;
    }

    await updateMatchScore(matchId, scoreA || "", scoreB || "");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
