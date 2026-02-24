#!/usr/bin/env python3
"""Common helpers for live EPL ingestion scripts."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path


import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "epl_pipeline.duckdb"
ENV_PATH = BASE_DIR / ".env"


def load_env_file() -> None:
    from dotenv import load_dotenv

    load_dotenv(ENV_PATH)


def now_iso() -> str:
    return datetime.utcnow().isoformat()


def get_conn() -> duckdb.DuckDBPyConnection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect(str(DB_PATH))
    conn.execute("CREATE SCHEMA IF NOT EXISTS raw")
    conn.execute("CREATE SCHEMA IF NOT EXISTS staging")
    conn.execute("CREATE SCHEMA IF NOT EXISTS mart")
    return conn


def ensure_live_tables(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.live_matches (
            source VARCHAR,
            match_id VARCHAR,
            competition VARCHAR,
            season VARCHAR,
            utc_date TIMESTAMP,
            status VARCHAR,
            minute INTEGER,
            home_team_name VARCHAR,
            away_team_name VARCHAR,
            home_score INTEGER,
            away_score INTEGER,
            winner VARCHAR,
            raw_json JSON,
            ingested_at TIMESTAMP
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.live_standings (
            source VARCHAR,
            competition VARCHAR,
            season VARCHAR,
            position INTEGER,
            team_name VARCHAR,
            played INTEGER,
            won INTEGER,
            draw INTEGER,
            lost INTEGER,
            goals_for INTEGER,
            goals_against INTEGER,
            goal_difference INTEGER,
            points INTEGER,
            form VARCHAR,
            raw_json JSON,
            ingested_at TIMESTAMP
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.pipeline_runs (
            run_id VARCHAR,
            pipeline_name VARCHAR,
            status VARCHAR,
            details VARCHAR,
            rows_written INTEGER,
            created_at TIMESTAMP
        )
        """
    )


def log_run(
    conn: duckdb.DuckDBPyConnection,
    pipeline_name: str,
    status: str,
    details: str,
    rows_written: int = 0,
) -> None:
    run_id = f"{pipeline_name}-{int(datetime.utcnow().timestamp())}"
    conn.execute(
        """
        INSERT INTO raw.pipeline_runs (run_id, pipeline_name, status, details, rows_written, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [run_id, pipeline_name, status, details, rows_written, datetime.utcnow()],
    )
