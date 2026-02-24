#!/usr/bin/env python3
"""Ingest latest EPL standings into DuckDB raw.live_standings.

Primary source: football-data.org
Fallback source: API-FOOTBALL if API_FOOTBALL_KEY exists (optional)
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any

import requests

from live_common import ensure_live_tables, get_conn, load_env_file, log_run


def fetch_football_data_org(api_key: str) -> list[dict[str, Any]]:
    url = "https://api.football-data.org/v4/competitions/PL/standings"
    r = requests.get(url, headers={"X-Auth-Token": api_key}, timeout=30)
    r.raise_for_status()
    payload = r.json()

    season = str(payload.get("season", {}).get("startDate", "current"))
    table = []
    for s in payload.get("standings", []):
        if s.get("type") == "TOTAL":
            table = s.get("table", [])
            break

    rows: list[dict[str, Any]] = []
    for t in table:
        rows.append(
            {
                "source": "football-data.org",
                "competition": payload.get("competition", {}).get("name", "Premier League"),
                "season": season,
                "position": t.get("position"),
                "team_name": t.get("team", {}).get("name"),
                "played": t.get("playedGames"),
                "won": t.get("won"),
                "draw": t.get("draw"),
                "lost": t.get("lost"),
                "goals_for": t.get("goalsFor"),
                "goals_against": t.get("goalsAgainst"),
                "goal_difference": t.get("goalDifference"),
                "points": t.get("points"),
                "form": t.get("form"),
                "raw_json": json.dumps(t),
            }
        )
    return rows


def fallback_from_local_mart(conn) -> list[dict[str, Any]]:
    # Demo fallback from existing mart if API key not present.
    df = conn.execute(
        """
        SELECT position, team_name, played, won, drawn as draw, lost,
               goals_for, goals_against, goal_difference, points
        FROM mart.mart_league_table
        ORDER BY position
        LIMIT 20
        """
    ).df()

    rows: list[dict[str, Any]] = []
    for _, t in df.iterrows():
        row = t.to_dict()
        row.update(
            {
                "source": "local-mart-fallback",
                "competition": "Premier League",
                "season": "2023/24",
                "form": None,
                "raw_json": json.dumps(row),
            }
        )
        rows.append(row)
    return rows


def main() -> None:
    load_env_file()
    api_key = os.getenv("FOOTBALL_DATA_API_KEY", "").strip()

    conn = get_conn()
    ensure_live_tables(conn)

    rows: list[dict[str, Any]] = []
    source_used = ""
    try:
        if api_key and api_key != "your-key-from-football-data.org":
            rows = fetch_football_data_org(api_key)
            source_used = "football-data.org"
        else:
            rows = fallback_from_local_mart(conn)
            source_used = "local-mart-fallback"
    except Exception:
        rows = fallback_from_local_mart(conn)
        source_used = "local-mart-fallback"

    now = datetime.now(UTC)
    inserted = 0
    for row in rows:
        conn.execute(
            """
            INSERT INTO raw.live_standings
            (source, competition, season, position, team_name, played, won, draw, lost,
             goals_for, goals_against, goal_difference, points, form, raw_json, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                row["source"], row["competition"], row["season"], row["position"],
                row["team_name"], row["played"], row["won"], row["draw"], row["lost"],
                row["goals_for"], row["goals_against"], row["goal_difference"], row["points"],
                row.get("form"), row["raw_json"], now,
            ],
        )
        inserted += 1

    log_run(conn, "live_standings", "success", f"source={source_used}", inserted)
    print(f"[LIVE_STANDINGS] inserted={inserted} source={source_used}")
    conn.close()


if __name__ == "__main__":
    main()
