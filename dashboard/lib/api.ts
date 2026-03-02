/**
 * Cloud API client — fetches live data from AWS CloudFront API
 * with fallback to static public/data/ JSON files.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_CLOUD_API_URL ||
  "https://dr81mm57l8sab.cloudfront.net";

/* ── Transformer helpers ─────────────────────────────────────────────── */

export interface Standing {
  position: number;
  team_id: number;
  team_name: string;
  team_short: string;
  tla: string;
  crest: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string;
  win_rate: number;
  points_pct: number;
  goals_per_game: number;
  goals_conceded_per_game: number;
}

export interface Scorer {
  player_name: string;
  nationality: string;
  team_name: string;
  team_short: string;
  tla: string;
  crest: string;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played_matches: number;
}

export interface Match {
  match_id: number;
  matchday: number;
  status: string;
  utc_date: string;
  home_team: string;
  away_team: string;
  home_short: string;
  away_short: string;
  home_tla: string;
  away_tla: string;
  home_crest: string;
  away_crest: string;
  home_score: number | null;
  away_score: number | null;
}

/* ── Transformers ────────────────────────────────────────────────────── */

function stripFC(name: string): string {
  return name.replace(/ FC$/, "").replace(/^AFC /, "").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformStandings(apiData: any): Standing[] {
  const standings = apiData?.data?.standings ?? apiData?.standings ?? [];
  const total = standings.find((s: { type: string }) => s.type === "TOTAL") ?? standings[0];
  if (!total?.table) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return total.table.map((t: any) => {
    const played = t.playedGames ?? 0;
    const won = t.won ?? 0;
    return {
      position: t.position,
      team_id: t.team?.id ?? t.position,
      team_name: stripFC(t.team?.name ?? ""),
      team_short: t.team?.shortName ?? "",
      tla: t.team?.tla ?? "",
      crest: t.team?.crest ?? "",
      played,
      won,
      drawn: t.draw ?? 0,
      lost: t.lost ?? 0,
      goals_for: t.goalsFor ?? 0,
      goals_against: t.goalsAgainst ?? 0,
      goal_difference: t.goalDifference ?? 0,
      points: t.points ?? 0,
      form: (t.form ?? "").replace(/,/g, " "),
      win_rate: played > 0 ? Math.round((won / played) * 1000) / 10 : 0,
      points_pct:
        played > 0
          ? Math.round(((t.points ?? 0) / (played * 3)) * 1000) / 10
          : 0,
      goals_per_game:
        played > 0
          ? Math.round(((t.goalsFor ?? 0) / played) * 100) / 100
          : 0,
      goals_conceded_per_game:
        played > 0
          ? Math.round(((t.goalsAgainst ?? 0) / played) * 100) / 100
          : 0,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformScorers(apiData: any): Scorer[] {
  const scorers = apiData?.data?.scorers ?? apiData?.scorers ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return scorers.map((s: any) => ({
    player_name: s.player?.name ?? "",
    nationality: s.player?.nationality ?? "",
    team_name: stripFC(s.team?.name ?? ""),
    team_short: s.team?.shortName ?? "",
    tla: s.team?.tla ?? "",
    crest: s.team?.crest ?? "",
    goals: s.goals ?? 0,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
    played_matches: s.playedMatches ?? 0,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformMatches(apiData: any): Match[] {
  const matches = apiData?.data?.matches ?? apiData?.matches ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return matches.map((m: any) => ({
    match_id: m.id,
    matchday: m.matchday,
    status: m.status,
    utc_date: m.utcDate,
    home_team: stripFC(m.homeTeam?.name ?? ""),
    away_team: stripFC(m.awayTeam?.name ?? ""),
    home_short: m.homeTeam?.shortName ?? "",
    away_short: m.awayTeam?.shortName ?? "",
    home_tla: m.homeTeam?.tla ?? "",
    away_tla: m.awayTeam?.tla ?? "",
    home_crest: m.homeTeam?.crest ?? "",
    away_crest: m.awayTeam?.crest ?? "",
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
  }));
}

/* ── Fetch helpers (with fallback) ───────────────────────────────────── */

async function fetchWithFallback<T>(
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformer: (data: any) => T,
  fallbackPath: string,
  revalidate = 300
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return transformer(data);
  } catch (err) {
    console.warn(`CloudFront ${endpoint} failed, using fallback:`, err);
    // Server-side fallback to static JSON
    if (typeof window === "undefined") {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "public", fallbackPath);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    }
    // Client-side fallback
    const res = await fetch(fallbackPath);
    return res.json();
  }
}

async function clientFetchWithFallback<T>(
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformer: (data: any) => T,
  fallbackPath: string
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return transformer(data);
  } catch (err) {
    console.warn(`CloudFront ${endpoint} failed, using fallback:`, err);
    const res = await fetch(fallbackPath, { cache: "no-store" });
    return res.json();
  }
}

/* ── Public API ──────────────────────────────────────────────────────── */

/** Server-side: standings with ISR revalidation */
export function fetchStandings(revalidate = 300) {
  return fetchWithFallback(
    "/standings",
    transformStandings,
    "/data/live_standings.json",
    revalidate
  );
}

/** Server-side: scorers with ISR revalidation */
export function fetchScorers(revalidate = 300) {
  return fetchWithFallback(
    "/scorers",
    transformScorers,
    "/data/top_scorers.json",
    revalidate
  );
}

/** Server-side: matches with ISR revalidation */
export function fetchMatches(revalidate = 300) {
  return fetchWithFallback(
    "/matches",
    transformMatches,
    "/data/matches.json",
    revalidate
  );
}

/** Client-side: live standings (no cache) */
export function fetchLiveStandings() {
  return clientFetchWithFallback(
    "/standings",
    transformStandings,
    "/data/live_standings.json"
  );
}

/** Client-side: live matches (no cache) */
export function fetchLiveMatches() {
  return clientFetchWithFallback(
    "/matches",
    transformMatches,
    "/data/live_matches.json"
  );
}

/** Client-side: cloud health check */
export async function fetchCloudHealth() {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
