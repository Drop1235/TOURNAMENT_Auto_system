import { NextResponse } from "next/server";
import { setByeForSide } from "@/lib/brackets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const matchId: string = body?.matchId;
    const side: "A" | "B" = body?.side;
    if (!matchId || (side !== "A" && side !== "B")) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    await setByeForSide(matchId, side);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
