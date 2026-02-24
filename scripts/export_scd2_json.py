#!/usr/bin/env python3
"""Export SCD2 standings history to JSON for dashboard consumption."""

from __future__ import annotations

import json
import math
from pathlib import Path

import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "epl_pipeline.duckdb"
OUT_PATH = BASE_DIR / "dashboard" / "public" / "data" / "scd2_standings.json"


def sanitize(val):
    """Replace NaN/Inf with None for JSON serialization."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def main() -> None:
    conn = duckdb.connect(str(DB_PATH), read_only=True)

    rows = conn.execute("""
        SELECT
            team_name, position, valid_from_matchday, valid_to_matchday,
            valid_from_date, valid_to_date, points, played,
            goals_for, goals_against, goal_difference,
            matchdays_held, prev_position, movement, is_current
        FROM mart.mart_scd2_standings
        ORDER BY team_name, valid_from_matchday
    """).fetchall()

    columns = [
        "team_name", "position", "valid_from_matchday", "valid_to_matchday",
        "valid_from_date", "valid_to_date", "points", "played",
        "goals_for", "goals_against", "goal_difference",
        "matchdays_held", "prev_position", "movement", "is_current",
    ]

    data = []
    for row in rows:
        record = {}
        for i, col in enumerate(columns):
            val = row[i]
            if hasattr(val, "isoformat"):
                val = val.isoformat()
            record[col] = sanitize(val)
        data.append(record)

    OUT_PATH.write_text(json.dumps(data, indent=2, default=str))
    print(f"[SCD2 EXPORT] {len(data)} version records written to scd2_standings.json")
    conn.close()


if __name__ == "__main__":
    main()
