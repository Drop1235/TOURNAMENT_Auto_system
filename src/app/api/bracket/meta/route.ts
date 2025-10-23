import { NextResponse } from "next/server";
import { getDataset, upsertDataset } from "@/lib/opClient";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const t = searchParams.get("tournamentId");
    if (!t) return NextResponse.json({ error: "tournamentId is required" }, { status: 400 });
    const meta = await getDataset(t, "meta");
    return NextResponse.json({ ok: true, meta: meta?.data || {} });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const t = (body?.tournamentId as string) || "";
    if (!t) return NextResponse.json({ error: "tournamentId is required" }, { status: 400 });
    const gameFormat = (body?.gameFormat as string) || undefined;
    const category = (body?.category as string) || undefined;

    // read current to merge
    const current = await getDataset(t, "meta").catch(() => null);
    const next = { ...(current?.data || {}), ...(category ? { category } : {}), ...(gameFormat ? { gameFormat } : {}) };

    await upsertDataset(t, "meta", next);
    return NextResponse.json({ ok: true, meta: next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
