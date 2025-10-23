import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertDataset } from "@/lib/opClient";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const t = (body?.tournamentId as string) || "";
    if (!t) return NextResponse.json({ error: "tournamentId is required" }, { status: 400 });

    // Fetch participants and matches
    const participants = await prisma.participant.findMany({ where: { tournamentId: t } });
    const pById = new Map<string, string>();
    for (const p of participants) pById.set(p.id, p.name);

    const matches = await prisma.match.findMany({ where: { tournamentId: t } });

    // Build OP match objects. Include matches where both sides have an assigned participant.
    const opMatches: any[] = [];
    let nextId = 1;
    for (const m of matches) {
      const aName = m.sideAId ? pById.get(m.sideAId) || "" : "";
      const bName = m.sideBId ? pById.get(m.sideBId) || "" : "";
      if (!aName || !bName) continue; // skip incomplete pairs
      opMatches.push({
        id: nextId++,
        playerA: aName,
        playerB: bName,
        gameFormat: "5game",
        status: "Unassigned",
        courtNumber: null,
        rowPosition: null,
      });
    }

    // Upsert to Supabase datasets as type='matches'
    await upsertDataset(t, "matches", { matches: opMatches });
    return NextResponse.json({ ok: true, count: opMatches.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
