#!/usr/bin/env python3
"""Export DuckDB mart tables  JSON for Next.js dashboard.

Local-first portfolio export.
Reads from DuckDB (data/epl_pipeline.duckdb) and writes to:
  dashboard/public/data/

Usage:
  python3 scripts/export_json.py

Environment:
  EPL_DB_PATH (optional)  path to DuckDB file
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = REPO_ROOT / "data" / "epl_pipeline.duckdb"
DB_PATH = Path(os.getenv("EPL_DB_PATH", str(DEFAULT_DB)))

DASH_DATA = REPO_ROOT / "dashboard" / "public" / "data"
DASH_DATA.mkdir(parents=True, exist_ok=True)

MART_SCHEMA = os.getenv("EPL_MART_SCHEMA", "epl_mart")
RAW_SCHEMA = os.getenv("EPL_RAW_SCHEMA", "raw")


def json_serial(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'item'):
        return obj.item()
    return str(obj)


def duckdb_to_records(con, sql: str) -> list[dict]:
    rel = con.sql(sql)
    # DuckDB returns pandas df conveniently
    df = rel.df()
    return df.to_dict(orient="records")


def export_table(con, name: str, sql: str, out_file: str):
    rows = duckdb_to_records(con, sql)
    out = DASH_DATA / out_file
    out.write_text(json.dumps(rows, indent=2, default=json_serial))
    log.info(f"   {out_file} ({len(rows)} rows)")
    return rows


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"DuckDB not found at {DB_PATH}. Run ingestion + dbt first (Airflow DAG ingest_epl_local)."
        )

    import duckdb

    log.info("Exporting DuckDB  dashboard JSON")
    log.info(f"  DB: {DB_PATH}")

    con = duckdb.connect(str(DB_PATH), read_only=True)

    export_table(
        con,
        "mart_league_table",
        f"""
        SELECT *
        FROM {MART_SCHEMA}.mart_league_table
        ORDER BY position
        """.strip(),
        "league_table.json",
    )

    export_table(
        con,
        "mart_recent_results",
        f"""
        SELECT *
        FROM {MART_SCHEMA}.mart_recent_results
        ORDER BY match_date DESC, matchday DESC
        LIMIT 380
        """.strip(),
        "recent_results.json",
    )

    export_table(
        con,
        "mart_top_scorers",
        f"""
        SELECT *
        FROM {MART_SCHEMA}.mart_top_scorers
        ORDER BY rank
        LIMIT 30
        """.strip(),
        "top_scorers.json",
    )

    # Helpful for other UI pages
    export_table(
        con,
        "matches",
        f"""
        SELECT *
        FROM {RAW_SCHEMA}.matches
        WHERE season_id = 2324
        ORDER BY match_date DESC
        """.strip(),
        "matches.json",
    )

    log.info(f" All exports written to {DASH_DATA}")


if __name__ == "__main__":
    main()
