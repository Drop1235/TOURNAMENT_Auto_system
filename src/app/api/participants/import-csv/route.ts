import { NextResponse } from "next/server";
import { parse, ParseError } from "papaparse";
import cuid from "cuid";

type CsvRow = {
  No?: string;
  "氏名"?: string;
  [key: string]: unknown;
};

type Participant = { id: string; name: string; seed: number };

function fallbackParse(text: string): Participant[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const participants: Participant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Pattern: "1. 山田 太郎" or "1,山田 太郎" or "1 山田 太郎"
    const m = line.match(/^\s*(\d+)\s*[\.|,、\-\s]+\s*(.+)$/);
    if (m) {
      const seed = Number(m[1]);
      const name = m[2].trim();
      participants.push({ id: cuid(), name: name || `Player ${seed}`, seed: seed || i + 1 });
      continue;
    }
    // Pattern: "山田 太郎" only
    participants.push({ id: cuid(), name: line, seed: i + 1 });
  }
  return participants;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const csvText: string = body?.csvText ?? "";
    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "csvText is required" }, { status: 400 });
    }

    // Try CSV with headers first
    const result = parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      delimitersToGuess: [",", "\t", ";", "|", " "],
    });

    let participants: Participant[] | null = null;
    const hasHeader = Array.isArray(result.meta?.fields) &&
      (result.meta.fields.includes("No") || result.meta.fields.includes("氏名"));

    if (!result.errors?.length && hasHeader) {
      const rows = (result.data || []).filter((r) => r && (r.No || r["氏名"])) as CsvRow[];
      participants = rows.map((row, idx) => {
        const rawNo = (row.No ?? "").toString().trim();
        const rawName = (row["氏名"] ?? "").toString().trim();
        const seed = Number(rawNo) || idx + 1;
        const name = rawName || `Player ${seed}`;
        return { id: cuid(), name, seed };
      });
    } else {
      // Fallback tolerant parsing for numbered lists or plain names
      participants = fallbackParse(csvText);
    }

    return NextResponse.json({ participants });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
