"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    setCsvText(text);
  }

  async function handleGenerate() {
    setError(null);
    if (!name.trim()) {
      setError("大会名を入力してください");
      return;
    }
    if (!category.trim()) {
      setError("カテゴリを入力してください");
      return;
    }
    if (!csvText.trim()) {
      setError("CSVを入力またはファイルを選択してください");
      return;
    }
    try {
      setLoading(true);
      // 1) parse participants
      const pRes = await fetch("/api/participants/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      if (!pRes.ok) throw new Error(await pRes.text());
      const pJson = await pRes.json();
      const participants = pJson.participants ?? [];
      if (!participants.length) throw new Error("参加者が取得できませんでした");

      // 2) init bracket
      const bRes = await fetch("/api/bracket/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentName: name.trim(), category: category.trim(), participants }),
      });
      if (!bRes.ok) throw new Error(await bRes.text());
      const { tournamentId } = await bRes.json();

      // 3) navigate to bracket
      router.push(`/bracket?t=${encodeURIComponent(tournamentId)}`);
    } catch (e: any) {
      setError(e?.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-semibold">トーナメント設定</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">大会名</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="大会名を入力"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">カテゴリ（必須）</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="例: 男子シングルス 35歳以上"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">CSV（ヘッダ: No,氏名）</label>
        <textarea
          className="w-full h-48 border rounded px-3 py-2 font-mono"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`No,氏名\n1,田中 太郎\n2,山田 花子`}
        />
        <div>
          <input type="file" accept=".csv" onChange={onFileChange} />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? "生成中..." : "ドロー生成"}
      </button>
    </main>
  );
}
