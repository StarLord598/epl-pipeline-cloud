"""
DAG: dbt_transform
Runs dbt models to transform raw data through staging → mart layers
Schedule: Runs after ingestion DAGs complete (triggered via dataset or hourly)
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag
from airflow.operators.bash import BashOperator

DBT_PROJECT_DIR = "/opt/airflow/dbt"


@dag(
    dag_id="dbt_transform",
    description="Run dbt transformations: staging → mart",
    schedule="30 * * * *",  # 30 min past every hour
    start_date=datetime(2024, 8, 1),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "epl-pipeline",
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
    },
    tags=["transform", "dbt"],
)
def dbt_transform():

    dbt_deps = BashOperator(
        task_id="dbt_deps",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt deps --profiles-dir {DBT_PROJECT_DIR} ",
    )

    dbt_run_staging = BashOperator(
        task_id="dbt_run_staging",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt run --select staging --profiles-dir {DBT_PROJECT_DIR} ",
    )

    dbt_test_staging = BashOperator(
        task_id="dbt_test_staging",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt test --select staging --profiles-dir {DBT_PROJECT_DIR} ",
    )

    dbt_run_mart = BashOperator(
        task_id="dbt_run_mart",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt run --select mart --profiles-dir {DBT_PROJECT_DIR} ",
    )

    dbt_test_mart = BashOperator(
        task_id="dbt_test_mart",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt test --select mart --profiles-dir {DBT_PROJECT_DIR} ",
    )

    dbt_deps >> dbt_run_staging >> dbt_test_staging >> dbt_run_mart >> dbt_test_mart


dbt_transform()
