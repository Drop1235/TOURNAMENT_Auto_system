"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CategoryEntry = { id: string; gameFormat: string; name: string; csvText: string };

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cats, setCats] = useState<CategoryEntry[]>([{ id: crypto.randomUUID(), gameFormat: "5game", name: "", csvText: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>, catId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Read as ArrayBuffer to support non-UTF8 encodings (e.g., Shift_JIS)
    const buf = await file.arrayBuffer();
    let text = "";
    try {
      // try strict UTF-8 first
      const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buf));
      text = utf8;
    } catch {
      // fallback to Shift_JIS commonly used in JP CSV exports
      try {
        const sjis = new TextDecoder("shift_jis").decode(new Uint8Array(buf));
        text = sjis;
      } catch {
        // last resort: permissive UTF-8 decode
        text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
      }
    }
    // Heuristic: if many replacement chars exist, try SJIS as a second pass
    const bad = (text.match(/\uFFFD/g) || []).length;
    if (bad > Math.max(3, text.length * 0.05)) {
      try {
        const sjis2 = new TextDecoder("shift_jis").decode(new Uint8Array(buf));
        text = sjis2;
      } catch {}
    }
    setCats((prev) => prev.map(c => c.id === catId ? { ...c, csvText: text } : c));
  }

  async function handleGenerate() {
    setError(null);
    if (!name.trim()) {
      setError("大会名を入力してください");
      return;
    }
    const filled = cats.filter(c => c.gameFormat && c.name.trim() && c.csvText.trim());
    if (!filled.length) {
      setError("カテゴリと選手リストを入力してください（複数可）");
      return;
    }
    try {
      setLoading(true);
      const created: { category: string; tournamentId: string }[] = [];
      for (const entry of filled) {
        // 1) parse participants per category
        const pRes = await fetch("/api/participants/import-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvText: entry.csvText }),
        });
        if (!pRes.ok) throw new Error(await pRes.text());
        const pJson = await pRes.json();
        const participants = pJson.participants ?? [];
        if (!participants.length) throw new Error(`参加者が取得できませんでした: ${entry.name}`);

        // 2) init bracket per category
        const bRes = await fetch("/api/bracket/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentName: name.trim(), category: `${entry.name}`.trim(), gameFormat: entry.gameFormat, participants }),
        });
        if (!bRes.ok) throw new Error(await bRes.text());
        const { tournamentId } = await bRes.json();
        created.push({ category: entry.name, tournamentId });
      }

      // 3) navigate to first created, and alert summary
      if (created.length) {
        const first = created[0];
        if (created.length > 1) {
          alert(`作成しました: \n${created.map(c => `${c.category}: ${c.tournamentId}`).join("\n")}`);
        }
        router.push(`/bracket?t=${encodeURIComponent(first.tournamentId)}`);
      }
    } catch (e: any) {
      setError(e?.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-semibold">トーナメント表詳細（複数追加可）</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">大会名</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="大会名を入力"
        />
      </div>

      {/* トーナメント（カテゴリ）× 複数。各エントリで [試合形式, カテゴリ, CSV] の順 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">トーナメント表詳細（各項目：試合形式、カテゴリ、選手リスト）</label>
          <button
            type="button"
            className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => setCats(prev => [...prev, { id: crypto.randomUUID(), gameFormat: "5game", name: "", csvText: "" }])}
          >
            + 追加
          </button>
        </div>

        {cats.map((c, idx) => (
          <div key={c.id} className="border rounded p-3 bg-white/60 space-y-2">
            {/* 試合形式 */}
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">試合形式</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={c.gameFormat}
                onChange={(e) => setCats(prev => prev.map(x => x.id === c.id ? { ...x, gameFormat: e.target.value } : x))}
              >
                <option value="5game">5G</option>
                <option value="4game1set">4G1set</option>
                <option value="6game1set">6G1set</option>
                <option value="6game1set_ntb">6G1set NoTB</option>
                <option value="8game1set">8G-Pro</option>
                <option value="4game2set">4G2set+10MTB</option>
                <option value="6game2set">6G2set+10MTB</option>
                <option value="4game3set">4G3set</option>
                <option value="6game3set">6G3set</option>
              </select>
            </div>

            {/* カテゴリ */}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border rounded px-3 py-2"
                value={c.name}
                onChange={(e) => setCats(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))}
                placeholder={`例: 10歳以下男子シングルス（${idx+1}）`}
                required
              />
              {cats.length > 1 && (
                <button
                  type="button"
                  className="px-2 py-1 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200"
                  onClick={() => setCats(prev => prev.filter(x => x.id !== c.id))}
                >
                  削除
                </button>
              )}
            </div>
            {/* CSV */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">選手リスト（No,氏名）</label>
              <textarea
                className="w-full h-40 border rounded px-3 py-2 font-mono"
                value={c.csvText}
                onChange={(e) => setCats(prev => prev.map(x => x.id === c.id ? { ...x, csvText: e.target.value } : x))}
                placeholder={`No,氏名\n1,田中 太郎\n2,山田 花子`}
              />
              <div>
                <input type="file" accept=".csv" onChange={(e) => onFileChange(e, c.id)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? "生成中..." : "ドロー生成（各カテゴリごと）"}
      </button>
    </main>
  );
}
