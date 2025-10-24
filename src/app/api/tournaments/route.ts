import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const list = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, category: true, year: true, createdAt: true },
    });
    return NextResponse.json({ tournaments: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
