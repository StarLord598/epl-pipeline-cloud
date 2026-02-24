#!/usr/bin/env python3
"""Backfill full 2025-26 EPL season match results into raw.live_matches.

Uses football-data.org API to fetch all completed matches.
Safe to run multiple times — deduplicates on match_id in silver/gold layers.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import requests

from env_check import require_football_api_key
from live_common import ensure_live_tables, get_conn, load_env_file, log_run
from log_config import setup_logger

log = setup_logger("backfill_season")


def fetch_all_matches(api_key: str) -> list[dict[str, Any]]:
    """Fetch all 2025-26 season matches from football-data.org."""
    headers = {"X-Auth-Token": api_key}
    url = "https://api.football-data.org/v4/competitions/PL/matches"

    all_rows: list[dict[str, Any]] = []
    # API returns all matches for current season by default
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    payload = r.json()

    competition = payload.get("competition", {}).get("name", "Premier League")
    season_start = payload.get("filters", {}).get("season", "2025")

    for m in payload.get("matches", []):
        all_rows.append({
            "source": "football-data.org",
            "match_id": str(m.get("id")),
            "competition": competition,
            "season": str(season_start),
            "utc_date": m.get("utcDate"),
            "status": m.get("status"),
            "minute": None,
            "home_team_name": m.get("homeTeam", {}).get("name"),
            "away_team_name": m.get("awayTeam", {}).get("name"),
            "home_score": m.get("score", {}).get("fullTime", {}).get("home"),
            "away_score": m.get("score", {}).get("fullTime", {}).get("away"),
            "winner": m.get("score", {}).get("winner"),
            "matchday": m.get("matchday"),
            "raw_json": json.dumps(m),
        })

    return all_rows


def main() -> None:
    load_env_file()
    api_key = require_football_api_key()

    conn = get_conn()
    ensure_live_tables(conn)

    log.info("Fetching full 2025-26 season from football-data.org...")
    rows = fetch_all_matches(api_key)

    # Check existing match IDs to avoid duplicates in raw
    existing = set(
        r[0] for r in conn.execute(
            "SELECT DISTINCT match_id FROM raw.live_matches WHERE source = 'football-data.org'"
        ).fetchall()
    )

    now = datetime.now(UTC)
    inserted = 0
    skipped = 0
    for row in rows:
        if row["match_id"] in existing:
            skipped += 1
            continue

        conn.execute(
            """
            INSERT INTO raw.live_matches
            (source, match_id, competition, season, utc_date, status, minute,
             home_team_name, away_team_name, home_score, away_score, winner, raw_json, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                row["source"], row["match_id"], row["competition"], row["season"],
                row["utc_date"], row["status"], row["minute"],
                row["home_team_name"], row["away_team_name"],
                row["home_score"], row["away_score"], row["winner"],
                row["raw_json"], now,
            ],
        )
        inserted += 1

    finished = len([r for r in rows if r["status"] == "FINISHED"])
    scheduled = len([r for r in rows if r["status"] in ("TIMED", "SCHEDULED")])

    log_run(conn, "backfill_season", "success", f"total={len(rows)} inserted={inserted} skipped={skipped}", inserted)
    log.info("Done: %d total matches (%d finished, %d scheduled)", len(rows), finished, scheduled)
    log.info("Inserted: %d, Skipped (already exists): %d", inserted, skipped)
    conn.close()


if __name__ == "__main__":
    main()
