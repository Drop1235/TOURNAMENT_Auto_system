"use client";

import useSWR from "swr";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error("fetch error");
  return r.json();
});

export default function TournamentsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ tournaments: { id: string; name: string; category: string; year: number; createdAt: string }[] }>("/api/tournaments", fetcher);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data?.tournaments || []).forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [data]);

  const years = useMemo(() => {
    const set = new Set<number>();
    (data?.tournaments || []).forEach(t => { if (typeof t.year === 'number') set.add(t.year); });
    return Array.from(set).sort((a,b)=>b-a);
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.tournaments || []).filter(t => {
      if (q && !(t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))) return false;
      if (catFilter && t.category !== catFilter) return false;
      if (yearFilter && String(t.year) !== yearFilter) return false;
      return true;
    });
  }, [data, query, catFilter, yearFilter]);

  const allSelectedOnPage = filtered.length > 0 && filtered.every(t => selected.has(t.id));

  const toggleSelectAll = () => {
    const next = new Set(selected);
    if (allSelectedOnPage) {
      filtered.forEach(t => next.delete(t.id));
    } else {
      filtered.forEach(t => next.add(t.id));
    }
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(`${ids.length} 件のトーナメントを削除します。よろしいですか？`);
    if (!ok) return;
    setBulkBusy(true);
    const failures: string[] = [];
    for (const id of ids) {
      try {
        const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) failures.push(id);
      } catch {
        failures.push(id);
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    await mutate();
    if (failures.length) {
      alert(`${ids.length - failures.length} 件削除成功、${failures.length} 件失敗しました\n失敗ID: ${failures.join(", ")}`);
    }
  }, [selected, mutate]);

  return (
    <main className="min-h-screen p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">トーナメント一覧</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="検索（名前/ID）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="border rounded px-2 py-1 text-sm" value={catFilter} onChange={(e)=>setCatFilter(e.target.value)}>
            <option value="">全カテゴリ</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={yearFilter} onChange={(e)=>setYearFilter(e.target.value)}>
            <option value="">全年度</option>
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkBusy || selected.size === 0}
            className="text-sm px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
          >
            {bulkBusy ? "一括削除中..." : `一括削除 (${selected.size})`}
          </button>
          <Link href="/" className="text-sm px-3 py-1.5 rounded bg-black text-white">新規作成</Link>
        </div>
      </div>
      {isLoading && <p>読み込み中...</p>}
      {error && <p className="text-red-600">読み込みに失敗しました</p>}
      <div className="grid gap-2">
        {filtered.length > 0 && (
          <label className="flex items-center gap-2 text-sm px-1">
            <input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAll} />
            <span>このページの全てを選択</span>
          </label>
        )}
        {filtered.map(t => (
          <div key={t.id} className="flex items-center justify-between border rounded bg-white/70 px-3 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} />
              <div className="min-w-0">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-xs text-gray-600">{t.category} / {t.year} / {t.id}</div>
              </div>
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
        {!isLoading && filtered.length === 0 && (
          <div className="text-sm text-gray-600">トーナメントはまだありません。トップから作成してください。</div>
        )}
      </div>
    </main>
  );
}
