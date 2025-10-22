"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { Suspense, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

// Defensive fallback for legacy bundles that might reference setBye in onClick
// This prevents ReferenceError if an old chunk is still cached somewhere
try {
  if (typeof globalThis !== "undefined") {
    const g: any = globalThis as any;
    if (typeof g.setBye !== "function") {
      g.setBye = () => {};
    }
  }
} catch {}

// Module-scope shim for legacy bundles that reference a free identifier `setBye`.
// We reassign this after defining the real handler below.
let setBye: (matchId: string, side: "A" | "B") => Promise<void> = async () => {};

type BracketData = {
  tournament: { id: string; name: string; size: number; category?: string };
  participants: { id: string; name: string; seed: number; no?: number }[];
  rounds: { index: number; name: string }[];
  matches: {
    id: string;
    roundIndex: number;
    roundName: string;
    sideAId: string | null;
    sideBId: string | null;
    scoreA: string | null;
    scoreB: string | null;
    winnerId: string | null;
    nextMatchId: string | null;
    winnerToSide: string | null;
    scheduledAt: string | null;
    court: string | null;
  }[];
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch error");
  return r.json();
});

const BOX_W0 = 300; // base width for round 1 (widest)
const BOX_H = 72;
const COL_GAP = 140;
const V_GAP = 36;
const HEADER_H = 28; // height of round header pills
const HEADER_MARGIN = 8; // margin from container top for headers
const PADDING_TOP = HEADER_H + HEADER_MARGIN + 16; // ensure boxes start below headers

function widthForRound(roundOrderIndex: number) {
  // visually shrink per round (approx half-ish look but keeping readability)
  const w = Math.round(BOX_W0 * Math.pow(0.7, roundOrderIndex));
  return Math.max(160, w);
}

export default function BracketPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-4 sm:p-6"><p>読み込み中...</p></main>}>
      <BracketPageInner />
    </Suspense>
  );
}

function BracketPageInner() {
  const sp = useSearchParams();
  const t = sp.get("t") || sp.get("tournamentId") || "";
  const { data, error, isLoading, mutate } = useSWR<BracketData>(
    t ? `/api/bracket?tournamentId=${encodeURIComponent(t)}` : null,
    fetcher
  );

  const byId = useMemo(() => {
    const map = new Map<string, { id: string; name: string; seed?: number; no?: number }>();
    (data?.participants || []).forEach((p) => map.set(p.id, { id: p.id, name: p.name, seed: p.seed, no: p.no }));
    return map;
  }, [data]);

  const rounds = useMemo(() => (data?.rounds || []).sort((a, b) => a.index - b.index), [data]);

  const matchesByRound = useMemo(() => {
    const m = new Map<number, BracketData["matches"]>();
    (data?.matches || [])
      .sort((a, b) => a.roundIndex - b.roundIndex)
      .forEach((mt) => {
        const arr = m.get(mt.roundIndex) || [];
        arr.push(mt);
        m.set(mt.roundIndex, arr);
      });
    return m;
  }, [data]);

  const layout = useMemo(() => {
    const map = new Map<string, { x: number; y: number; r: number; i: number }>();
    const unit = BOX_H + V_GAP;
    if (!rounds.length) return map;

    // Build ordered match lists per round
    const ordered = new Map<number, BracketData["matches"]>();

    // Round 0 ordered by seed ascending (min of A/B)
    const r0 = rounds[0].index;
    const l0 = (matchesByRound.get(r0) || []).slice().sort((a, b) => {
      const minSeed = (mm: BracketData["matches"][number]) => {
        const sA = mm.sideAId ? (byId.get(mm.sideAId)?.seed ?? 9999) : 9999;
        const sB = mm.sideBId ? (byId.get(mm.sideBId)?.seed ?? 9999) : 9999;
        return Math.min(sA, sB);
      };
      return minSeed(a) - minSeed(b);
    });
    ordered.set(r0, l0);

    // Subsequent rounds: order by predecessors' order index from previous round
    for (let ridx = 1; ridx < rounds.length; ridx++) {
      const prevIdx = rounds[ridx - 1].index;
      const prevOrdered = ordered.get(prevIdx) || [];
      const indexInPrev = new Map<string, number>();
      prevOrdered.forEach((m, i) => indexInPrev.set(m.id, i));

      const r = rounds[ridx].index;
      const list = (matchesByRound.get(r) || []).slice();
      const ord = list
        .map((m) => {
          const preds = (data?.matches || []).filter((pm) => pm.nextMatchId === m.id);
          const keys = preds.map((p) => indexInPrev.get(p.id) ?? 99999);
          const minKey = keys.length ? Math.min(...keys) : 99999;
          return { m, key: minKey };
        })
        .sort((a, b) => a.key - b.key)
        .map((x) => x.m);
      ordered.set(r, ord);
    }

    // Assign positions: round 0 stacked; following rounds use average Y of predecessors
    // X positions are cumulative widths per column
    const colXOf = (ridx: number) =>
      rounds.slice(0, ridx).reduce((acc, _, i) => acc + widthForRound(i) + COL_GAP, 0);

    // Place round 0
    (ordered.get(r0) || []).forEach((m, i) => {
      map.set(m.id, { x: colXOf(0), y: PADDING_TOP + i * unit, r: r0, i });
    });

    // Place next rounds based on predecessors' center Y
    for (let ridx = 1; ridx < rounds.length; ridx++) {
      const rIndex = rounds[ridx].index;
      const thisRound = ordered.get(rIndex) || [];
      thisRound.forEach((m, i) => {
        const preds = (data?.matches || []).filter((pm) => pm.nextMatchId === m.id);
        const ys = preds.map((p) => map.get(p.id)?.y).filter((v): v is number => typeof v === "number");
        const y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : PADDING_TOP + i * unit * Math.pow(2, ridx);
        map.set(m.id, { x: colXOf(ridx), y, r: rIndex, i });
      });
    }

    return map;
  }, [rounds, matchesByRound, data, byId]);

  const width = useMemo(() => {
    let total = 16;
    rounds.forEach((_, idx) => {
      total += widthForRound(idx) + COL_GAP;
    });
    return total;
  }, [rounds]);
  const height = useMemo(() => {
    let maxY = 0;
    (data?.matches || []).forEach((m) => {
      const pos = layout.get(m.id);
      if (pos) maxY = Math.max(maxY, pos.y);
    });
    return maxY + BOX_H + PADDING_TOP;
  }, [layout, data]);

  // derive effective category: prefer tournament.category; if absent or 'General', infer common leading phrase from participant names
  const effectiveCategory = useMemo(() => {
    const explicit = data?.tournament?.category?.trim();
    if (explicit && explicit !== "General") return explicit;
    const names = (data?.participants || []).map((p) => p.name || "");
    if (names.length < 2) return explicit || "";
    // longest common prefix
    let prefix = names[0];
    for (let i = 1; i < names.length && prefix; i++) {
      const s = names[i];
      let j = 0;
      while (j < prefix.length && j < s.length && prefix[j] === s[j]) j++;
      prefix = prefix.slice(0, j);
    }
    prefix = prefix.trim();
    // heuristics: acceptable only if sufficiently long and category-like
    const isCategoryLike = /歳|男子|女子|シングルス|ダブルス|ミックス/.test(prefix);
    if (prefix.length >= 4 && isCategoryLike) return prefix;
    return explicit || "";
  }, [data]);

  // compute unplaced participants (not assigned to any side in any match)
  const unplaced = useMemo(() => {
    const placed = new Set<string>();
    (data?.matches || []).forEach((m) => {
      if (m.sideAId) placed.add(m.sideAId);
      if (m.sideBId) placed.add(m.sideBId);
    });
    const list = (data?.participants || []).filter((p) => !placed.has(p.id));
    // sort by No (ascending), fallback by name
    return list.sort((a, b) => {
      const na = typeof a.no === "number" ? a.no : Number.MAX_SAFE_INTEGER;
      const nb = typeof b.no === "number" ? b.no : Number.MAX_SAFE_INTEGER;
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  function onDragStart(e: React.DragEvent, participantId: string) {
    e.dataTransfer.setData("text/plain", participantId);
    e.dataTransfer.effectAllowed = "move";
  }

  function displayName(name: string) {
    const cat = effectiveCategory?.trim();
    let s = name || "";
    if (cat) {
      // remove exact category occurrences and adjacent separators
      s = s.replaceAll(cat, "");
      s = s.replace(/^[\s:\-\|／/]+/, ""); // leading separators
      s = s.replace(/[\s:\-\|／/]+$/, ""); // trailing separators
    }
    // strip leading No (half/full width digits) with separators like '.', '、', ',', ':', '：', '-', spaces, brackets
    s = s.replace(/^(?:No\.?\s*)?[0-9\uFF10-\uFF19]+[)）\.．、,:：\-\s]*/u, "");
    return s.trim();
  }

  async function placeParticipant(matchId: string, side: "A" | "B", participantId: string) {
    if (!t) return;
    const res = await fetch("/api/draw/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: t, matchId, side, participantId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      throw new Error(j?.error || "failed to place");
    }
    await mutate();
  }

  async function unplaceParticipant(matchId: string, side: "A" | "B") {
    if (!t) return;
    const res = await fetch("/api/draw/unplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: t, matchId, side }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      alert(j?.error || "戻す操作に失敗しました");
      return;
    }
    await mutate();
  }

  async function resetPlacements() {
    if (!t) return;
    const ok = window.confirm("すべての配置をリセットします。よろしいですか？");
    if (!ok) return;
    const res = await fetch("/api/draw/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: t }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      alert(j?.error || "リセットに失敗しました");
      return;
    }
    await mutate();
  }

  const handleSetBye = useCallback(async (matchId: string, side: "A" | "B") => {
    const res = await fetch("/api/draw/bye", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, side }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      alert(j?.error || "BYE 設定に失敗しました");
      return;
    }
    await mutate();
  }, [mutate]);

  // Assign to legacy shim for any old bundles that still reference `setBye` directly
  setBye = handleSetBye;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">{data?.tournament?.name ?? "トーナメント表"}</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetPlacements}
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
          >
            配置をリセット
          </button>
          <div className="text-sm text-gray-500">トーナメントID: {t}</div>
        </div>
      </div>
      {(effectiveCategory || data?.tournament?.category) && (
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm">
            {effectiveCategory || data?.tournament?.category}
          </span>
        </div>
      )}

      {isLoading && <p>読み込み中...</p>}
      {error && <p className="text-red-600">読み込みに失敗しました</p>}

      {data && (
        <div className="relative overflow-hidden">
          <div className="flex gap-4">
            {/* Unplaced panel */}
            <div className="w-64 shrink-0 border rounded bg-white/70 p-2 h-[calc(100vh-200px)] overflow-auto">
              <div className="font-medium text-sm mb-2">未配置</div>
              <div className="space-y-2">
                {unplaced.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, p.id)}
                    className="border rounded px-2 py-2 bg-white cursor-move shadow-sm hover:bg-gray-50 text-sm flex items-center gap-2"
                    title={`${p.no ?? ""} ${displayName(p.name)}`}
                  >
                    <span className="inline-flex items-center justify-center w-10 text-xs bg-gray-200 rounded">{p.no ?? ""}</span>
                    <span className="truncate">{displayName(p.name)}</span>
                  </div>
                ))}
                {!unplaced.length && <div className="text-xs text-gray-500">未配置の参加者はいません</div>}
              </div>
            </div>

            {/* Bracket canvas */}
            <div className="relative overflow-auto border rounded bg-white/40 flex-1" style={{ height: height + 64 }}>
              <div className="relative" style={{ width, height }}>
                {/* round headers */}
                {rounds.map((r, idx) => (
                  <div
                    key={r.index}
                    className="absolute top-0 left-0 text-xs"
                    style={{ transform: `translate(${rounds.slice(0, idx).reduce((acc, _, i) => acc + widthForRound(i) + COL_GAP, 0)}px, ${HEADER_MARGIN}px)` }}
                  >
                    <span className="inline-block px-3 py-1 rounded-full bg-gray-300/80 text-gray-800">
                      {(() => {
                        const last = rounds.length - 1;
                        if (idx === 0) return "1回戦";
                        if (idx === last) return "決勝";
                        if (idx === last - 1) return "準決勝";
                        if (idx === last - 2) return "準々決勝";
                        return `${idx + 1}回戦`;
                      })()}
                    </span>
                  </div>
                ))}
                {/* connectors */}
                <svg className="absolute inset-0" width={width} height={height}>
                  {(data.matches || []).map((m) => {
                    if (!m.nextMatchId) return null;
                    const a = layout.get(m.id);
                    const b = layout.get(m.nextMatchId);
                    if (!a || !b) return null;
                    const x1 = a.x + widthForRound(rounds.findIndex((rr) => rr.index === a.r));
                    const y1 = a.y + BOX_H / 2;
                    const x2 = b.x;
                    const y2 = b.y + BOX_H / 2;
                    const midX = (x1 + x2) / 2;
                    const decided = !!m.winnerId;
                    const stroke = decided ? "#D4A106" : "#bbb"; // winner path in yellow
                    const widthS = decided ? 3 : 2;
                    return (
                      <g key={`${m.id}->${m.nextMatchId}`} stroke={stroke} fill="none">
                        <path d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} strokeWidth={widthS} />
                      </g>
                    );
                  })}
                </svg>

                {/* boxes */}
                {(data.matches || []).map((m) => {
                  const pos = layout.get(m.id);
                  if (!pos) return null;
                  const rw = widthForRound(rounds.findIndex((rr) => rr.index === pos.r));
                  return (
                    <div
                      key={m.id}
                      className="absolute border-2 rounded bg-white shadow-sm border-gray-300"
                      style={{ left: pos.x, top: pos.y, width: rw, height: BOX_H }}
                    >
                      <MatchBox
                        match={m}
                        byId={byId}
                        onSaved={() => mutate()}
                        onDropPlace={placeParticipant}
                        onUnplace={unplaceParticipant}
                        onSetBye={handleSetBye}
                        category={effectiveCategory || data.tournament.category}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MatchBox({
  match,
  byId,
  onSaved,
  onDropPlace,
  onUnplace,
  onSetBye,
  category,
}: {
  match: BracketData["matches"][number];
  byId: Map<string, { id: string; name: string; seed?: number; no?: number }>;
  onSaved: () => void;
  onDropPlace: (matchId: string, side: "A" | "B", participantId: string) => Promise<void>;
  onUnplace: (matchId: string, side: "A" | "B") => Promise<void>;
  onSetBye: (matchId: string, side: "A" | "B") => Promise<void>;
  category?: string;
}) {
  const aP = match.sideAId ? byId.get(match.sideAId) : undefined;
  const bP = match.sideBId ? byId.get(match.sideBId) : undefined;
  function stripCat(name?: string) {
    if (!name) return "";
    const cat = category?.trim();
    let s = name;
    if (cat) {
      s = s.replaceAll(cat, "");
      s = s.replace(/^[\s:\-\|／/]+/, "");
      s = s.replace(/[\s:\-\|／/]+$/, "");
    }
    s = s.replace(/^(?:No\.?\s*)?[0-9\uFF10-\uFF19]+[)）\.．、,:：\-\s]*/u, "");
    return s.trim();
  }
  const a = stripCat(aP?.name);
  const b = stripCat(bP?.name);

  function total(score?: string | null) {
    if (!score) return 0;
    return score
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .reduce((acc, seg) => {
        const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!m) return acc;
        return acc + Number(m[1]);
      }, 0);
  }

  const tA = total(match.scoreA);
  const tB = total(match.scoreB);
  const aWin = match.winnerId && match.winnerId === match.sideAId;
  const bWin = match.winnerId && match.winnerId === match.sideBId;

  const [overA, setOverA] = useState(false);
  const [overB, setOverB] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, side: "A" | "B") {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;
    await onDropPlace(match.id, side, pid);
    if (side === "A") setOverA(false); else setOverB(false);
  }

  return (
    <div className="h-full w-full p-2 flex flex-col">
      {/* Row A */}
      <div
        className={`flex items-center mt-1 rounded border transition-colors ${
          overA ? "bg-blue-100 border-blue-400 ring-2 ring-blue-300" : aWin ? "bg-yellow-200 border-yellow-300" : "bg-gray-50 border-transparent"
        }`}
        onDragOver={handleDragOver}
        onDragEnter={() => setOverA(true)}
        onDragLeave={() => setOverA(false)}
        onDrop={(e) => handleDrop(e, "A")}
      >
        <div className="w-10 text-xs text-gray-600 px-2 shrink-0">{typeof aP?.no === "number" ? aP.no : ""}</div>
        <div className={`flex-1 min-w-0 text-sm ${aWin ? "font-semibold" : "text-gray-700"}`}>
          <span className="block truncate">{a || (b ? "BYE" : "TBD")}</span>
        </div>
        {aP ? (
          <button
            type="button"
            onClick={() => onUnplace(match.id, "A")}
            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 mr-1 shrink-0"
            title="未配置に戻す"
          >
            戻す
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSetBye(match.id, "A")}
            className="text-xs px-2 py-1 bg-amber-200 rounded hover:bg-amber-300 mr-1 shrink-0"
            title="空き枠をBYEとして相手を自動勝ち上がり"
          >
            BYE
          </button>
        )}
        <div className={`w-8 text-center text-sm mx-1 rounded shrink-0 ${aWin ? "bg-yellow-300" : "bg-gray-200"}`}>{tA || (a ? 0 : "")}</div>
      </div>

      {/* Row B */}
      <div
        className={`flex items-center mt-1 rounded border transition-colors ${
          overB ? "bg-blue-100 border-blue-400 ring-2 ring-blue-300" : bWin ? "bg-yellow-200 border-yellow-300" : "bg-gray-50 border-transparent"
        }`}
        onDragOver={handleDragOver}
        onDragEnter={() => setOverB(true)}
        onDragLeave={() => setOverB(false)}
        onDrop={(e) => handleDrop(e, "B")}
      >
        <div className="w-10 text-xs text-gray-600 px-2 shrink-0">{typeof bP?.no === "number" ? bP.no : ""}</div>
        <div className={`flex-1 min-w-0 text-sm ${bWin ? "font-semibold" : "text-gray-700"}`}>
          <span className="block truncate">{b || (a ? "BYE" : "TBD")}</span>
        </div>
        {bP ? (
          <button
            type="button"
            onClick={() => onUnplace(match.id, "B")}
            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 mr-1 shrink-0"
            title="未配置に戻す"
          >
            戻す
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSetBye(match.id, "B")}
            className="text-xs px-2 py-1 bg-amber-200 rounded hover:bg-amber-300 mr-1 shrink-0"
            title="空き枠をBYEとして相手を自動勝ち上がり"
          >
            BYE
          </button>
        )}
        <div className={`w-8 text-center text-sm mx-1 rounded shrink-0 ${bWin ? "bg-yellow-300" : "bg-gray-200"}`}>{tB || (b ? 0 : "")}</div>
      </div>
    </div>
  );
}
