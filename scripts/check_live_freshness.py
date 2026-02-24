#!/usr/bin/env python3
"""Compute freshness metrics and materialize live monitoring tables."""

from __future__ import annotations

from live_common import ensure_live_tables, get_conn, log_run


def main() -> None:
    conn = get_conn()
    ensure_live_tables(conn)

    conn.execute(
        """
        CREATE OR REPLACE VIEW staging.silver_live_match_state AS
        WITH ranked AS (
            SELECT
                source,
                match_id,
                competition,
                season,
                utc_date,
                status,
                minute,
                home_team_name,
                away_team_name,
                home_score,
                away_score,
                winner,
                ingested_at,
                ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY ingested_at DESC) AS rn
            FROM raw.live_matches
        )
        SELECT * EXCLUDE (rn)
        FROM ranked
        WHERE rn = 1
        """
    )

    conn.execute(
        """
        CREATE OR REPLACE TABLE mart.gold_live_match_monitor AS
        WITH agg AS (
            SELECT
                COUNT(*) AS active_match_count,
                MAX(ingested_at) AS last_ingested_at,
                GREATEST(0, DATE_DIFF('minute', MAX(ingested_at), NOW())) AS freshness_minutes
            FROM staging.silver_live_match_state
        )
        SELECT
            active_match_count,
            last_ingested_at,
            freshness_minutes,
            CASE
                WHEN freshness_minutes <= 20 THEN 'PASS_MATCHDAY_SLA'
                WHEN freshness_minutes <= 90 THEN 'PASS_OFFDAY_SLA'
                ELSE 'FAIL'
            END AS freshness_status,
            NOW() AS computed_at
        FROM agg
        """
    )

    row = conn.execute(
        "SELECT active_match_count, freshness_minutes, freshness_status FROM mart.gold_live_match_monitor"
    ).fetchone()

    log_run(
        conn,
        "check_live_freshness",
        "success",
        f"active={row[0]} freshness_minutes={row[1]} status={row[2]}",
        int(row[0] or 0),
    )
    print(f"[FRESHNESS] active={row[0]} freshness_minutes={row[1]} status={row[2]}")
    conn.close()


if __name__ == "__main__":
    main()
