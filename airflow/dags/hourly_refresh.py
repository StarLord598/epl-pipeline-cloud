"""DAG: hourly_refresh

Goal: keep local demo data fresh.
- Runs live ingestion + freshness monitor + exports JSON for dashboard.

This DAG is local-first and lift-and-shift friendly.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag
from airflow.operators.bash import BashOperator


@dag(
    dag_id="hourly_refresh",
    description="Hourly refresh: live ingest + monitoring + export JSON (local DuckDB)",
    schedule="0 * * * *",
    start_date=datetime(2026, 2, 20),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "epl-pipeline",
        "retries": 2,
        "retry_delay": timedelta(minutes=2),
    },
    tags=["local", "live", "hourly"],
)
def hourly_refresh():
    # NOTE: inside docker-compose, repo root is /opt/airflow
    run_live = BashOperator(
        task_id="run_live_pipeline",
        bash_command="cd /opt/airflow && bash scripts/run_live_pipeline.sh ",
    )

    # Optional: export full dashboard JSON from existing mart tables
    export_json = BashOperator(
        task_id="export_dashboard_json",
        bash_command="cd /opt/airflow && python3 scripts/export_json.py || true ",
    )

    # Export live matches/standings JSON for the Live dashboard page
    export_live = BashOperator(
        task_id="export_live_json",
        bash_command="cd /opt/airflow && python3 scripts/export_live_json.py || true ",
    )

    run_live >> export_json >> export_live


hourly_refresh()
