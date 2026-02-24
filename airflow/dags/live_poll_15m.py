from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import ShortCircuitOperator

default_args = {
    "retries": 3,
    "retry_delay": timedelta(seconds=30),
}


def check_matchday(**context):
    """Skip live polling on non-matchdays to avoid wasted API calls."""
    import subprocess
    result = subprocess.run(
        ["python", "scripts/is_matchday.py"],
        capture_output=True, text=True, cwd="/opt/airflow"
    )
    is_matchday = result.stdout.strip() == "true"
    if not is_matchday:
        print("Non-matchday — skipping live poll")
    return is_matchday


with DAG(
    dag_id="live_poll_15m",
    start_date=datetime(2026, 2, 20),
    schedule="*/15 * * * *",
    catchup=False,
    max_active_runs=1,
    tags=["live", "epl", "portfolio"],
    default_args=default_args,
) as dag:
    matchday_check = ShortCircuitOperator(
        task_id="matchday_check",
        python_callable=check_matchday,
    )

    fetch_matches_live = BashOperator(
        task_id="fetch_matches_live",
        bash_command="cd /opt/airflow && python scripts/ingest_live_matches.py ",
    )

    fetch_standings_live = BashOperator(
        task_id="fetch_standings_live",
        bash_command="cd /opt/airflow && python scripts/ingest_live_standings.py ",
    )

    validate_raw_payloads = BashOperator(
        task_id="validate_raw_payloads",
        bash_command="cd /opt/airflow && python scripts/validate_live_payloads.py ",
    )

    run_dbt_live_silver = BashOperator(
        task_id="run_dbt_live_silver",
        bash_command="cd /opt/airflow/dbt && dbt run --select stg_live_standings stg_live_matches mart_live_league_table mart_live_matches --profiles-dir /opt/airflow/dbt ",
    )

    run_monitoring_checks = BashOperator(
        task_id="run_monitoring_checks",
        bash_command="cd /opt/airflow && python scripts/check_live_freshness.py ",
    )

    export_live_json = BashOperator(
        task_id="export_live_json",
        bash_command="cd /opt/airflow && python scripts/export_live_json.py || true ",
    )

    matchday_check >> fetch_matches_live >> fetch_standings_live >> validate_raw_payloads >> run_dbt_live_silver >> run_monitoring_checks >> export_live_json
