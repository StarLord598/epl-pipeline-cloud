#!/usr/bin/env python3
"""Export data quality metrics to JSON for the quality dashboard."""

from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import duckdb

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _safe_id(name: str) -> str:
    """Validate and quote a SQL identifier to prevent injection."""
    if not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return f'"{name}"'


def sanitize(records: list[dict]) -> list[dict]:
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                rec[k] = None
    return records


def main() -> None:
    db_path = Path(__file__).parent.parent / "data" / "epl_pipeline.duckdb"
    out_path = Path(__file__).parent.parent / "dashboard" / "public" / "data"
    conn = duckdb.connect(str(db_path), read_only=True)

    now = datetime.now(timezone.utc).isoformat()

    # Table-level metrics
    tables = []
    for schema in ["raw", "staging", "mart"]:
        for row in conn.execute("""
            SELECT table_name, estimated_size, column_count
            FROM duckdb_tables()
            WHERE schema_name = ?
        """, [schema]).fetchall():
            # Get row count
            count = conn.execute(f"SELECT COUNT(*) FROM {_safe_id(schema)}.{_safe_id(row[0])}").fetchone()[0]
            tables.append({
                "schema": schema,
                "table": row[0],
                "row_count": count,
                "column_count": row[2],
                "layer": "Bronze" if schema == "raw" else "Silver" if schema == "staging" else "Gold",
            })

    # Also check views in staging (Silver layer is all views — zero storage by design)
    for row in conn.execute("""
        SELECT view_name as table_name FROM duckdb_views()
        WHERE schema_name = 'staging'
    """).fetchall():
        count = conn.execute(f"SELECT COUNT(*) FROM {_safe_id('staging')}.{_safe_id(row[0])}").fetchone()[0]
        col_count = conn.execute("""
            SELECT COUNT(*) FROM duckdb_columns()
            WHERE schema_name = 'staging' AND table_name = ?
        """, [row[0]]).fetchone()[0]
        tables.append({
            "schema": "staging",
            "table": row[0],
            "row_count": count,
            "column_count": col_count,
            "layer": "Silver",
        })

    # Freshness checks
    freshness = []
    try:
        latest_ingest = conn.execute(
            "SELECT MAX(ingested_at) FROM raw.live_matches"
        ).fetchone()[0]
        if latest_ingest:
            freshness.append({
                "table": "raw.live_matches",
                "last_updated": str(latest_ingest),
                "sla_hours": 1,
            })
    except Exception:
        pass

    try:
        latest_standings = conn.execute(
            "SELECT MAX(ingested_at) FROM raw.live_standings"
        ).fetchone()[0]
        if latest_standings:
            freshness.append({
                "table": "raw.live_standings",
                "last_updated": str(latest_standings),
                "sla_hours": 1,
            })
    except Exception:
        pass

    # dbt test results (parse from run_results.json if available)
    dbt_results_path = Path(__file__).parent.parent / "dbt" / "target" / "run_results.json"
    test_results = []
    if dbt_results_path.exists():
        with open(dbt_results_path) as f:
            run_results = json.load(f)
        for result in run_results.get("results", []):
            if result.get("unique_id", "").startswith("test."):
                test_results.append({
                    "test_name": result["unique_id"].split(".")[-1],
                    "status": result["status"],
                    "execution_time": round(result.get("execution_time", 0), 3),
                    "message": result.get("message", ""),
                })

    quality = {
        "generated_at": now,
        "tables": sanitize(tables),
        "freshness": freshness,
        "tests": {
            "total": len(test_results),
            "passed": sum(1 for t in test_results if t["status"] == "pass"),
            "failed": sum(1 for t in test_results if t["status"] == "fail"),
            "warned": sum(1 for t in test_results if t["status"] == "warn"),
            "results": test_results,
        },
        "summary": {
            "total_tables": len(tables),
            "bronze_tables": sum(1 for t in tables if t["layer"] == "Bronze"),
            "silver_tables": sum(1 for t in tables if t["layer"] == "Silver"),
            "gold_tables": sum(1 for t in tables if t["layer"] == "Gold"),
            "total_rows": sum(t["row_count"] for t in tables),
        },
    }

    out_path.joinpath("quality.json").write_text(json.dumps(quality, indent=2, default=str))
    print(f"quality.json: {len(tables)} tables, {len(test_results)} tests")
    conn.close()


if __name__ == "__main__":
    main()
