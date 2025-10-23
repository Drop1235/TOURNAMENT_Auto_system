export async function upsertDataset(tournamentId: string, type: string, payload: any) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const base = url.replace(/\/+$/, "");
  const body = [
    {
      tournament_id: tournamentId,
      type,
      data: payload,
      updated_at: new Date().toISOString(),
    },
  ];
  const res = await fetch(`${base}/rest/v1/datasets`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return false;
  }
  return true;
}

export async function getDataset(tournamentId: string, type: string): Promise<any | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const base = url.replace(/\/+$/, "");
  const res = await fetch(
    `${base}/rest/v1/datasets?select=*&tournament_id=eq.${encodeURIComponent(tournamentId)}&type=eq.${encodeURIComponent(type)}&order=updated_at.desc&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );
  if (!res.ok) return null;
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}
