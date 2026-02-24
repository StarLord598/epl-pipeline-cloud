"""DAG: daily_reconcile

Goal: daily full rebuild to prove batch + quality + serving.
- Re-ingest batch sources
- Run dbt (if configured)
- Run live pipeline (for health)
- Export dashboard JSON

Local-first (DuckDB), designed for reproducible local development.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag
from airflow.operators.bash import BashOperator


@dag(
    dag_id="daily_reconcile",
    description="Daily reconcile: batch ingest + (optional) dbt + exports (local)",
    schedule="0 2 * * *",
    start_date=datetime(2026, 2, 20),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "epl-pipeline",
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
    },
    tags=["local", "batch", "daily"],
)
def daily_reconcile():
    ingest_statsbomb = BashOperator(
        task_id="ingest_statsbomb",
        bash_command="cd /opt/airflow && python scripts/ingest_data.py ",
        retries=2,
        retry_delay=timedelta(seconds=30),
    )

    ingest_season = BashOperator(
        task_id="ingest_full_season",
        bash_command="cd /opt/airflow && python scripts/ingest_full_season.py ",
        retries=2,
        retry_delay=timedelta(seconds=30),
    )

    # dbt (optional). If you run DuckDB dbt locally, keep this as a no-op in airflow container.
    dbt_run = BashOperator(
        task_id="dbt_run_optional",
        bash_command="cd /opt/airflow/dbt && (dbt run || true) ",
    )

    dbt_test = BashOperator(
        task_id="dbt_test_optional",
        bash_command="cd /opt/airflow/dbt && (dbt test || true) ",
    )

    run_live = BashOperator(
        task_id="run_live_pipeline",
        bash_command="cd /opt/airflow && bash scripts/run_live_pipeline.sh ",
        retries=2,
        retry_delay=timedelta(seconds=30),
    )

    export_json = BashOperator(
        task_id="export_dashboard_json",
        bash_command="cd /opt/airflow && python scripts/export_to_json.py || true ",
    )

    ingest_statsbomb >> ingest_season >> dbt_run >> dbt_test >> run_live >> export_json


daily_reconcile()
