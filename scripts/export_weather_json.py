#!/usr/bin/env python3
"""Export stadium weather data from Gold mart to dashboard JSON."""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import duckdb

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-5s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "epl_pipeline.duckdb"
OUT_PATH = BASE_DIR / "dashboard" / "public" / "data" / "weather.json"


def sanitize(val):
    """Replace NaN/Inf with None for JSON safety."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def export():
    conn = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        rows = conn.execute("SELECT * FROM mart.mart_stadium_weather ORDER BY team_name").fetchdf()
    except duckdb.CatalogException:
        log.warning("mart.mart_stadium_weather not found — run dbt build first")
        return
    finally:
        conn.close()

    records = []
    for _, row in rows.iterrows():
        records.append({k: sanitize(v) for k, v in row.to_dict().items()})

    # Convert timestamps to strings
    for r in records:
        if r.get("fetched_at") is not None:
            r["fetched_at"] = str(r["fetched_at"])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(records, f, indent=2, default=str)

    log.info("Exported %d stadium weather records → %s", len(records), OUT_PATH)


if __name__ == "__main__":
    export()
