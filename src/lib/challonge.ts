const API_BASE = "https://api.challonge.com/v1";

function getApiKey() {
  const key = process.env.CHALLONGE_API_KEY;
  if (!key) throw new Error("CHALLONGE_API_KEY is not set");
  return key;
}

function getSubdomain() {
  return process.env.CHALLONGE_SUBDOMAIN || undefined;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(API_BASE + path);
  url.searchParams.set("api_key", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Challonge POST failed ${res.status}: ${txt}`);
  }
  return res.json();
}

async function putJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Challonge PUT failed ${res.status}: ${txt}`);
  }
  return res.json();
}

async function getJson(url: string) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Challonge GET failed ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function createTournament(name: string): Promise<{ id: number; url: string }>
{
  const subdomain = getSubdomain();
  const url = buildUrl("/tournaments.json");
  const body: any = {
    tournament: {
      name,
      tournament_type: "single elimination",
    },
  };
  if (subdomain) body.tournament.subdomain = subdomain;
  const data = await postJson(url, body);
  // Response shape: { tournament: { id, url, ... } }
  const t = data?.tournament;
  return { id: t.id, url: t.url };
}

export async function bulkAddParticipants(tournamentId: string | number, names: string[]) {
  const url = buildUrl(`/tournaments/${tournamentId}/participants/bulk_add.json`);
  // Challonge expects { participants: [ { name }, { name }, ... ] }
  const participants = names.map((n) => ({ name: n }));
  const data = await postJson(url, { participants });
  // Response: [ { participant: { id, name, ... } }, ... ]
  return data as Array<{ participant: { id: number; name: string } }>;
}

export async function listMatches(tournamentId: string | number) {
  const url = buildUrl(`/tournaments/${tournamentId}/matches.json`);
  const data = await getJson(url);
  return data as Array<{ match: any }>;
}

export async function putMatchResult(
  tournamentId: string | number,
  matchId: number,
  scoresCsv: string,
  winnerId: number
) {
  const url = buildUrl(`/tournaments/${tournamentId}/matches/${matchId}.json`);
  const body = {
    match: {
      scores_csv: scoresCsv,
      winner_id: winnerId,
    },
  };
  const data = await putJson(url, body);
  return data as { match: any };
}
