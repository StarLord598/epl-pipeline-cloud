"""
DAG: ingest_epl_local
Local EPL data ingestion pipeline using DuckDB instead of BigQuery.
Pulls 2023-24 EPL data from football-data.co.uk and StatsBomb Open Data.

Can be run directly as a Python script OR as an Airflow DAG.
Requires: duckdb, statsbombpy, pandas, requests in venv313/
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Check if Airflow is available
try:
    from airflow.decorators import dag, task
    AIRFLOW_AVAILABLE = True
except ImportError:
    AIRFLOW_AVAILABLE = False

# In Docker: dags are at /opt/airflow/dags, repo root is /opt/airflow
# Locally: dags are at <repo>/airflow/dags, repo root is <repo> (2 levels up)
_DAG_DIR = Path(__file__).parent
_CANDIDATE = _DAG_DIR.parent.parent  # local layout: airflow/dags -> airflow -> repo
REPO_ROOT = Path("/opt/airflow") if Path("/opt/airflow/scripts").exists() else _CANDIDATE
VENV_PYTHON = REPO_ROOT / "venv313" / "bin" / "python3"
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _run_script(script_name: str) -> str:
    """Run a pipeline script in the venv."""
    python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
    result = subprocess.run(
        [python, str(SCRIPTS_DIR / script_name)],
        capture_output=True, text=True, check=True
    )
    print(result.stdout)
    if result.returncode != 0:
        raise Exception(f"Script {script_name} failed:\n{result.stderr}")
    return result.stdout


if AIRFLOW_AVAILABLE:
    @dag(
        dag_id="ingest_epl_local",
        description="EPL 2023-24 local ingestion pipeline (DuckDB)",
        schedule="0 6 * * *",  # Daily at 6am
        start_date=datetime(2024, 8, 1),
        catchup=False,
        max_active_runs=1,
        default_args={
            "owner": "epl-pipeline",
            "retries": 1,
            "retry_delay": timedelta(minutes=5),
        },
        tags=["epl", "local", "duckdb"],
    )
    def ingest_epl_local():

        @task()
        def ingest_statsbomb_events():
            """Ingest StatsBomb match events data."""
            return _run_script("ingest_data.py")

        @task()
        def ingest_full_season():
            """Ingest full 2023-24 season from football-data.co.uk."""
            return _run_script("ingest_full_season.py")

        @task()
        def run_dbt_transforms():
            """Run dbt models to build staging + mart layers."""
            dbt = REPO_ROOT / "venv313" / "bin" / "dbt"
            dbt_bin = str(dbt) if dbt.exists() else "dbt"
            env = os.environ.copy()
            env["EPL_DB_PATH"] = str(REPO_ROOT / "data" / "epl_pipeline.duckdb")

            dbt_dir = str(REPO_ROOT / "dbt")
            result = subprocess.run(
                [dbt_bin, "run", "--project-dir", dbt_dir, "--profiles-dir", dbt_dir],
                capture_output=True,
                text=True,
                check=False,
                env=env,
            )
            print(result.stdout)
            if result.returncode != 0:
                raise Exception(f"dbt run failed:\n{result.stderr}")
            return "dbt: OK"

        @task()
        def export_dashboard_json():
            """Export mart data to JSON for dashboard consumption."""
            return _run_script("export_json.py")

        # Pipeline chain
        events = ingest_statsbomb_events()
        season = ingest_full_season()
        transforms = run_dbt_transforms()
        export = export_dashboard_json()

        [events, season] >> transforms >> export

    ingest_epl_local()

else:
    # When run directly (not in Airflow), execute pipeline steps sequentially
    if __name__ == "__main__":
        print("[DAG] Running EPL pipeline locally (Airflow not available)")
        print("[DAG] Step 1: StatsBomb events")
        _run_script("ingest_data.py")
        print("[DAG] Step 2: 2023-24 season data")
        _run_script("ingest_full_season.py")
        print("[DAG] Done! Run dbt separately with: cd dbt && dbt run")
