#!/usr/bin/env python3
"""Check if today is within a matchday window (match day ±1).

Used by Airflow ShortCircuitOperator to skip live polling on non-matchdays.
Exit code 0 + prints "true" = matchday, exit code 0 + prints "false" = skip.
"""

from __future__ import annotations

from datetime import date

from live_common import get_conn, load_env_file


def main() -> None:
    load_env_file()
    conn = get_conn()

    today = date.today()
    result = conn.execute("""
        WITH matchdays AS (
            SELECT DISTINCT ON (match_id)
                CAST(json_extract_string(raw_json, '$.matchday') AS INTEGER) AS matchday,
                utc_date::DATE AS match_date,
                status
            FROM raw.live_matches
            WHERE source = 'football-data.org'
            ORDER BY match_id, ingested_at DESC
        )
        SELECT COUNT(*) FROM matchdays
        WHERE match_date BETWEEN ? - INTERVAL '1 day' AND ? + INTERVAL '1 day'
    """, [today, today]).fetchone()[0]

    conn.close()

    if result > 0:
        print("true")  # Matchday — proceed with polling
    else:
        print("false")  # Non-matchday — skip


if __name__ == "__main__":
    main()
