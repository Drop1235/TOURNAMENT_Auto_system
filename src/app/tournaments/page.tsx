"use client";

import useSWR from "swr";
import Link from "next/link";
import { useCallback, useState } from "react";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error("fetch error");
  return r.json();
});

export default function TournamentsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ tournaments: { id: string; name: string; category: string; year: number; createdAt: string }[] }>("/api/tournaments", fetcher);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    const ok = window.confirm("このトーナメント表を削除します。よろしいですか？");
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j?.error || "削除に失敗しました");
      await mutate();
    } catch (e: any) {
      alert(e?.message || "削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  }, [mutate]);

  return (
    <main className="min-h-screen p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">トーナメント一覧</h1>
        <Link href="/" className="text-sm px-3 py-1.5 rounded bg-black text-white">新規作成</Link>
      </div>
      {isLoading && <p>読み込み中...</p>}
      {error && <p className="text-red-600">読み込みに失敗しました</p>}
      <div className="grid gap-2">
        {(data?.tournaments || []).map(t => (
          <div key={t.id} className="flex items-center justify-between border rounded bg-white/70 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{t.name}</div>
              <div className="text-xs text-gray-600">{t.category} / {t.year} / {t.id}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/bracket?t=${encodeURIComponent(t.id)}`} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">開く</Link>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={busyId === t.id}
                className="px-3 py-1.5 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                {busyId === t.id ? "削除中..." : "削除"}
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (data?.tournaments || []).length === 0 && (
          <div className="text-sm text-gray-600">トーナメントはまだありません。トップから作成してください。</div>
        )}
      </div>
    </main>
  );
}
