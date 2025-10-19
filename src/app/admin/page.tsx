"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type BracketData = {
  tournament: { id: string; name: string };
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch error");
  return r.json();
});

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-6"><p>読み込み中...</p></main>}>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const sp = useSearchParams();
  const t = sp.get("t") || sp.get("tournamentId") || "";

  const { data: bracket } = useSWR<BracketData>(
    t ? `/api/bracket?tournamentId=${encodeURIComponent(t)}` : null,
    fetcher
  );

  const { data: status } = useSWR<{ hasApiKey: boolean; hasSubdomain: boolean }>(
    "/api/sync/challonge/status",
    fetcher
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(path: string, body: any) {
    setMsg(null);
    setBusy(path);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt);
      setMsg("OK");
    } catch (e: any) {
      setMsg(e?.message || "エラー");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Challonge連携</h1>
        <div className="text-sm text-gray-500">tournamentId: {t}</div>
      </div>

      <div className="text-sm">
        <div>大会名: <span className="font-medium">{bracket?.tournament?.name ?? "-"}</span></div>
        <div className="mt-1">環境変数: API_KEY {status?.hasApiKey ? "OK" : "未設定"} / SUBDOMAIN {status?.hasSubdomain ? "OK" : "未設定"}</div>
      </div>

      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={() => run("/api/sync/challonge/tournament", { name: bracket?.tournament?.name ?? "Tournament", tournamentId: t })}
          disabled={!t || !!busy}
        >
          {busy === "/api/sync/challonge/tournament" ? "作成中..." : "Challonge大会作成"}
        </button>

        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={() => run("/api/sync/challonge/participants", { tournamentId: t })}
          disabled={!t || !!busy}
        >
          {busy === "/api/sync/challonge/participants" ? "同期中..." : "参加者同期"}
        </button>

        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={() => run("/api/sync/challonge/match-result", { tournamentId: t, localMatchId: "" })}
          disabled={!t || !!busy}
          title="個別試合の反映は各マッチから行うことを推奨。ここではサンプル呼び出しのみ"
        >
          {busy === "/api/sync/challonge/match-result" ? "反映中..." : "結果反映(サンプル)"}
        </button>
      </div>

      {msg && <div className="text-sm">{msg}</div>}
    </main>
  );
}
