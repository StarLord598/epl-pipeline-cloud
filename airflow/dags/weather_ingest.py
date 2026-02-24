"""DAG: Ingest stadium weather data every 30 minutes via Open-Meteo API."""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

VENV = "/opt/airflow/venv/bin/python"
SCRIPTS = "/opt/airflow/scripts"
DBT_DIR = "/opt/airflow/dbt"

default_args = {
    "owner": "rocket",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
}

with DAG(
    dag_id="weather_ingest",
    default_args=default_args,
    description="Ingest real-time weather for EPL stadiums (Open-Meteo, free)",
    schedule="*/5 * * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["weather", "streaming", "live"],
) as dag:
    ingest = BashOperator(
        task_id="ingest_weather",
        bash_command=f"{VENV} {SCRIPTS}/ingest_weather.py ",
    )

    dbt_weather = BashOperator(
        task_id="dbt_run_weather",
        bash_command=f"cd {DBT_DIR} && dbt run --select stg_stadium_weather mart_stadium_weather --profiles-dir . --target local ",
    )

    export = BashOperator(
        task_id="export_weather_json",
        bash_command=f"{VENV} {SCRIPTS}/export_weather_json.py ",
    )

    ingest >> dbt_weather >> export
