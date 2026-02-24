#!/usr/bin/env python3
"""Ingest live/recent EPL match states into DuckDB raw.live_matches.

Primary source: football-data.org (requires FOOTBALL_DATA_API_KEY)
Fallback source (demo-safe): TheSportsDB free endpoint
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import requests

from live_common import ensure_live_tables, get_conn, load_env_file, log_run
from log_config import setup_logger

log = setup_logger("ingest_live_matches")


def fetch_football_data_org(api_key: str) -> list[dict[str, Any]]:
    headers = {"X-Auth-Token": api_key}
    today = datetime.now(timezone.utc).date()
    date_from = (today - timedelta(days=1)).isoformat()
    date_to = (today + timedelta(days=2)).isoformat()

    url = "https://api.football-data.org/v4/competitions/PL/matches"
    params = {"dateFrom": date_from, "dateTo": date_to}
    r = requests.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    payload = r.json()

    rows: list[dict[str, Any]] = []
    for m in payload.get("matches", []):
        rows.append(
            {
                "source": "football-data.org",
                "match_id": str(m.get("id")),
                "competition": payload.get("competition", {}).get("name", "Premier League"),
                "season": str(payload.get("filters", {}).get("season") or "current"),
                "utc_date": m.get("utcDate"),
                "status": m.get("status"),
                "minute": None,
                "home_team_name": m.get("homeTeam", {}).get("name"),
                "away_team_name": m.get("awayTeam", {}).get("name"),
                "home_score": m.get("score", {}).get("fullTime", {}).get("home"),
                "away_score": m.get("score", {}).get("fullTime", {}).get("away"),
                "winner": m.get("score", {}).get("winner"),
                "raw_json": json.dumps(m),
            }
        )
    return rows


def fetch_thesportsdb_fallback() -> list[dict[str, Any]]:
    # 4328 = English Premier League
    url = "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    payload = r.json()

    rows: list[dict[str, Any]] = []
    for m in payload.get("events", []) or []:
        dt = None
        if m.get("dateEvent") and m.get("strTime"):
            dt = f"{m.get('dateEvent')}T{m.get('strTime')}"
        rows.append(
            {
                "source": "thesportsdb",
                "match_id": str(m.get("idEvent")),
                "competition": m.get("strLeague") or "Premier League",
                "season": m.get("strSeason") or "current",
                "utc_date": dt,
                "status": m.get("strStatus") or "SCHEDULED",
                "minute": None,
                "home_team_name": m.get("strHomeTeam"),
                "away_team_name": m.get("strAwayTeam"),
                "home_score": int(m["intHomeScore"]) if m.get("intHomeScore") else None,
                "away_score": int(m["intAwayScore"]) if m.get("intAwayScore") else None,
                "winner": None,
                "raw_json": json.dumps(m),
            }
        )
    return rows


def main() -> None:
    load_env_file()
    api_key = os.getenv("FOOTBALL_DATA_API_KEY", "").strip()
    log.info("Starting live match ingestion")

    conn = get_conn()
    ensure_live_tables(conn)

    rows: list[dict[str, Any]] = []
    source_used = ""
    raw_matches: list[dict] = []  # for contract validation
    try:
        if api_key and api_key != "your-key-from-football-data.org":
            rows = fetch_football_data_org(api_key)
            source_used = "football-data.org"
            # Schema contract validation
            try:
                from contracts import validate_matches
                raw_matches = [json.loads(r["raw_json"]) for r in rows if r.get("raw_json")]
                result = validate_matches(raw_matches)
                if not result.valid:
                    log.warning("Contract validation FAILED: %d/%d records OK", result.records_passed, result.records_checked)
                    for v in result.violations[:5]:
                        log.warning("  [%s] %s: %s", v.severity, v.field, v.message)
                else:
                    log.info("Contract validated: %d/%d records OK", result.records_passed, result.records_checked)
            except ImportError:
                log.warning("Contract validation skipped: contracts module not available")
        else:
            rows = fetch_thesportsdb_fallback()
            source_used = "thesportsdb"
    except Exception:
        rows = fetch_thesportsdb_fallback()
        source_used = "thesportsdb-fallback"

    now = datetime.now(UTC)
    inserted = 0
    for row in rows:
        conn.execute(
            """
            INSERT INTO raw.live_matches
            (source, match_id, competition, season, utc_date, status, minute,
             home_team_name, away_team_name, home_score, away_score, winner, raw_json, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                row["source"],
                row["match_id"],
                row["competition"],
                row["season"],
                row["utc_date"],
                row["status"],
                row["minute"],
                row["home_team_name"],
                row["away_team_name"],
                row["home_score"],
                row["away_score"],
                row["winner"],
                row["raw_json"],
                now,
            ],
        )
        inserted += 1

    log_run(conn, "live_matches", "success", f"source={source_used}", inserted)
    log.info("Ingestion complete: inserted=%d source=%s", inserted, source_used)
    conn.close()


if __name__ == "__main__":
    main()
