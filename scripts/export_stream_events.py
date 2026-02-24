#!/usr/bin/env python3
"""Export StatsBomb match events for SSE streaming replay."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import duckdb

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-5s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "epl_pipeline.duckdb"
OUT_PATH = BASE_DIR / "dashboard" / "public" / "data" / "stream_events.json"


def export():
    conn = duckdb.connect(str(DB_PATH), read_only=True)

    # Get top 10 matches by event count (most exciting)
    matches = conn.execute("""
        SELECT e.match_id, m.home_team_name, m.away_team_name,
               m.home_score, m.away_score, COUNT(*) as event_count
        FROM raw.events e
        JOIN raw.matches m ON e.match_id = m.match_id
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY event_count DESC
        LIMIT 10
    """).fetchall()

    result = {}
    match_index = []

    for match_id, home, away, h_score, a_score, evt_count in matches:
        events = conn.execute("""
            SELECT event_id, match_id, index_num, period, minute, second,
                   event_type, team_name, player_name, position_name,
                   location_x, location_y, sub_type, outcome
            FROM raw.events
            WHERE match_id = ?
            ORDER BY period, minute, second, index_num
        """, [match_id]).fetchall()

        cols = ["event_id", "match_id", "index_num", "period", "minute", "second",
                "event_type", "team_name", "player_name", "position_name",
                "location_x", "location_y", "sub_type", "outcome"]

        result[str(match_id)] = [dict(zip(cols, row)) for row in events]

        match_index.append({
            "match_id": match_id,
            "home_team": home,
            "away_team": away,
            "home_score": h_score,
            "away_score": a_score,
            "event_count": evt_count,
        })
        log.info("  %s %d-%d %s (%d events)", home, h_score, a_score, away, evt_count)

    result["_index"] = match_index

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, default=str)

    conn.close()
    log.info("Exported %d matches → %s", len(match_index), OUT_PATH)


if __name__ == "__main__":
    export()
