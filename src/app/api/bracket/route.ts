import { NextResponse } from "next/server";
import { getBracket } from "@/lib/brackets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 });
    }
    const data = await getBracket(tournamentId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
