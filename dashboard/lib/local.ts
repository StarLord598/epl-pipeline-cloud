/**
 * Local Data Layer for the EPL Dashboard
 * =========================================
 * Server-side only — reads from DuckDB-exported JSON files in public/data/.
 * In the cloud version, this is replaced with BigQuery queries.
 */

import path from "path";
import fs from "fs";

/** Read a local JSON file from public/data/. */
function readLocal<T>(filename: string): T[] {
  const p = path.join(process.cwd(), "public", "data", filename);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T[];
  }
  return [];
}

// ── Typed query helpers ─────────────────────────────────────────────────────────

export async function getLeagueTable() {
  // Prefer live standings (current season)
  const live = readLocal("live_standings.json");
  if (Array.isArray(live) && live.length > 0) return live;
  return readLocal("league_table.json");
}

export async function getRecentResults(limit = 380) {
  const data = readLocal<Record<string, unknown>>("recent_results.json");
  return data.slice(0, limit);
}

export async function getTopScorers(limit = 20) {
  const data = readLocal<Record<string, unknown>>("top_scorers.json");
  return data.slice(0, limit);
}

export async function getMatches(limit = 380) {
  const data = readLocal<Record<string, unknown>>("matches.json");
  return data.slice(0, limit);
}
