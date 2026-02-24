#!/usr/bin/env python3
"""Export live monitoring table (mart.gold_live_match_monitor) to dashboard public JSON.

This keeps the demo fully local without needing Node<->DuckDB drivers.
Run this after scripts/check_live_freshness.py.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from live_common import get_conn

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_PATH = BASE_DIR / "dashboard" / "public" / "data" / "live_monitor.json"


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    try:
        row = conn.execute(
            """
            SELECT active_match_count, last_ingested_at, freshness_minutes, freshness_status, computed_at
            FROM mart.gold_live_match_monitor
            """
        ).fetchone()

        payload = {
            "active_match_count": int(row[0]) if row and row[0] is not None else 0,
            "last_ingested_at": str(row[1]) if row else None,
            "freshness_minutes": int(row[2]) if row and row[2] is not None else None,
            "freshness_status": row[3] if row else None,
            "computed_at": str(row[4]) if row else None,
            "exported_at": datetime.utcnow().isoformat(),
        }

        OUT_PATH.write_text(json.dumps(payload, indent=2))
        print(f"[EXPORT_MONITOR] wrote {OUT_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
