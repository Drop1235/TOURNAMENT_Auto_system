import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const p = await prisma.participant.findUnique({ where: { id } });
    if (!p) return NextResponse.json({ error: "participant not found" }, { status: 404 });

    // Check if placed in any match
    const placed = await prisma.match.count({ where: { OR: [{ sideAId: id }, { sideBId: id }] } });
    if (placed > 0) {
      return NextResponse.json(
        { error: "配置されているため削除できません。未配置に戻してから削除してください。" },
        { status: 409 }
      );
    }

    await prisma.participant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
