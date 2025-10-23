"use client";

import { useMemo, useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function BracketsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-6">読み込み中...</main>}>
      <BracketsInner />
    </Suspense>
  );
}

function BracketsInner() {
  const sp = useSearchParams();
  const raw = sp.get("ids") || ""; // comma-separated tournamentIds
  const initial = (sp.get("active") || "").trim();
  const ids = useMemo(() => raw.split(",").map(s => s.trim()).filter(Boolean), [raw]);
  const [active, setActive] = useState<string>(initial && ids.includes(initial) ? initial : (ids[0] || ""));
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let abort = false;
    async function load() {
      const ent = await Promise.all(ids.map(async (id) => {
        try {
          const res = await fetch(`/api/bracket?tournamentId=${encodeURIComponent(id)}`);
          const j = await res.json();
          const cat = j?.tournament?.category || "";
          return [id, cat] as const;
        } catch {
          return [id, ""] as const;
        }
      }));
      if (!abort) {
        const map: Record<string, string> = {};
        ent.forEach(([id, cat]) => { map[id] = cat || ""; });
        setLabels(map);
      }
    }
    if (ids.length) load();
    return () => { abort = true; };
  }, [ids.join(",")]);

  if (!ids.length) {
    return (
      <main className="min-h-screen p-6 space-y-4">
        <h1 className="text-xl font-semibold">複数トーナメント</h1>
        <p className="text-gray-600 text-sm">クエリに ids パラメータ（カンマ区切りのトーナメントID群）が必要です。</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">複数トーナメント</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`px-3 py-1.5 rounded text-sm border ${active === id ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50 border-gray-300"}`}
            title={id}
          >
            {labels[id] ? labels[id] : shorten(id)}
          </button>
        ))}
      </div>

      {/* Active bracket (iframe) */}
      <div className="border rounded overflow-hidden bg-white">
        <iframe
          key={active}
          src={`/bracket?t=${encodeURIComponent(active)}`}
          className="w-full"
          style={{ height: "80vh" }}
        />
      </div>
    </main>
  );
}

function shorten(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}
