#!/usr/bin/env python3
"""Export live match + standings data → dashboard JSON.

Reads from DuckDB Gold mart tables (mart.mart_live_matches / mart.mart_live_league_table),
falls back to football-data.org API if DB is empty.

Output:
  dashboard/public/data/live_matches.json
  dashboard/public/data/live_standings.json
"""
from __future__ import annotations

import json
import logging
import math
import os
from datetime import date, timedelta
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = REPO_ROOT / "data" / "epl_pipeline.duckdb"
DB_PATH = Path(os.getenv("EPL_DB_PATH", str(DEFAULT_DB)))
DASH_DATA = REPO_ROOT / "dashboard" / "public" / "data"
DASH_DATA.mkdir(parents=True, exist_ok=True)

API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "").strip()



def json_serial(obj):
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "item"):
        return obj.item()
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return str(obj)


def sanitize_records(records):
    """Replace NaN/Inf with None in dicts for JSON serialization."""
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                rec[k] = None
    return records


def export_from_duckdb():
    """Try to export live data from DuckDB."""
    import duckdb

    if not DB_PATH.exists():
        return False

    con = duckdb.connect(str(DB_PATH), read_only=True)

    # Live matches — read from Gold mart (medallion architecture)
    try:
        matches_df = con.sql("""
            SELECT
                match_id,
                utc_date,
                status,
                minute,
                home_team,
                away_team,
                home_score,
                away_score,
                competition,
                matchday,
                ingested_at
            FROM mart.mart_live_matches
            WHERE utc_date >= CURRENT_DATE - INTERVAL '1 day'
              AND utc_date <= CURRENT_DATE + INTERVAL '3 days'
            ORDER BY utc_date DESC
        """).df()

        if len(matches_df) > 0:
            records = matches_df.to_dict(orient="records")
            out = DASH_DATA / "live_matches.json"
            out.write_text(json.dumps(sanitize_records(records), indent=2, default=json_serial))
            log.info(f"  live_matches.json ({len(records)} matches)")
        else:
            log.info("  No PL live matches in DuckDB, will try API fallback")
            return False
    except Exception as e:
        log.warning(f"  live_matches query failed: {e}")
        return False

    # Live standings — read from Gold mart (medallion architecture)
    try:
        standings_df = con.sql("""
            SELECT
                position,
                team_name,
                played,
                won,
                drawn,
                lost,
                points,
                goals_for,
                goals_against,
                goal_difference,
                win_rate,
                points_pct,
                goals_per_game,
                goals_conceded_per_game,
                qualification_zone,
                form
            FROM mart.mart_live_league_table
            ORDER BY position
        """).df()

        if len(standings_df) > 0:
            standings_df = standings_df.sort_values("position")
            records = standings_df.to_dict(orient="records")
            out = DASH_DATA / "live_standings.json"
            out.write_text(json.dumps(sanitize_records(records), indent=2, default=json_serial))
            log.info(f"  live_standings.json ({len(records)} teams)")
        else:
            log.info("  No standings in DuckDB")
    except Exception as e:
        log.warning(f"  live_standings query failed: {e}")

    return True


def export_from_api():
    """Fallback: fetch directly from football-data.org API."""
    import requests

    if not API_KEY:
        log.warning("  No FOOTBALL_DATA_API_KEY set, skipping API fallback")
        return False

    headers = {"X-Auth-Token": API_KEY}
    today = date.today()
    date_from = today.isoformat()
    date_to = (today + timedelta(days=3)).isoformat()

    # Matches
    try:
        url = "https://api.football-data.org/v4/competitions/PL/matches"
        r = requests.get(url, headers=headers, params={"dateFrom": date_from, "dateTo": date_to}, timeout=30)
        r.raise_for_status()
        data = r.json()

        matches = []
        for m in data.get("matches", []):
            matches.append({
                "match_id": m["id"],
                "utc_date": m["utcDate"],
                "status": m["status"],
                "minute": m.get("minute"),
                "home_team": m["homeTeam"]["shortName"] if "shortName" in m["homeTeam"] else m["homeTeam"]["name"],
                "away_team": m["awayTeam"]["shortName"] if "shortName" in m["awayTeam"] else m["awayTeam"]["name"],
                "home_score": m["score"]["fullTime"]["home"],
                "away_score": m["score"]["fullTime"]["away"],
                "competition": "Premier League",
                "matchday": m.get("matchday", 0),
            })

        out = DASH_DATA / "live_matches.json"
        out.write_text(json.dumps(sanitize_records(matches), indent=2, default=json_serial))
        log.info(f"  live_matches.json ({len(matches)} matches from API)")
    except Exception as e:
        log.warning(f"  API matches failed: {e}")
        return False

    # Standings
    try:
        url = "https://api.football-data.org/v4/competitions/PL/standings"
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()

        standings = []
        for entry in data.get("standings", []):
            if entry["type"] == "TOTAL":
                for t in entry["table"]:
                    standings.append({
                        "position": t["position"],
                        "team_name": t["team"]["shortName"] if "shortName" in t["team"] else t["team"]["name"],
                        "played": t["playedGames"],
                        "won": t["won"],
                        "drawn": t["draw"],
                        "lost": t["lost"],
                        "points": t["points"],
                        "goals_for": t["goalsFor"],
                        "goals_against": t["goalsAgainst"],
                        "goal_difference": t["goalDifference"],
                    })

        out = DASH_DATA / "live_standings.json"
        out.write_text(json.dumps(sanitize_records(standings), indent=2, default=json_serial))
        log.info(f"  live_standings.json ({len(standings)} teams from API)")
    except Exception as e:
        log.warning(f"  API standings failed: {e}")

    return True


def main():
    log.info("Exporting live data → dashboard JSON")

    success = False
    try:
        success = export_from_duckdb()
    except ImportError:
        log.info("  duckdb not available locally, trying API")

    if not success:
        export_from_api()

    log.info(f"  Exports written to {DASH_DATA}")


if __name__ == "__main__":
    main()
