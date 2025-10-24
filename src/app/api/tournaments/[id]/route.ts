import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Delete children first
    await prisma.match.deleteMany({ where: { tournamentId: id } });
    await prisma.drawNode.deleteMany({ where: { tournamentId: id } }).catch(() => {});
    await prisma.participant.deleteMany({ where: { tournamentId: id } });

    await prisma.tournament.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
