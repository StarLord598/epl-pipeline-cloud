"""Shared test fixtures for EPL pipeline tests."""

import sys
from pathlib import Path

import duckdb
import pytest

# Add scripts/ to path so we can import pipeline modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))


@pytest.fixture
def db():
    """In-memory DuckDB connection with raw schema."""
    conn = duckdb.connect(":memory:")
    conn.execute("CREATE SCHEMA IF NOT EXISTS raw")
    conn.execute("CREATE SCHEMA IF NOT EXISTS staging")
    conn.execute("CREATE SCHEMA IF NOT EXISTS mart")
    yield conn
    conn.close()


@pytest.fixture
def sample_match():
    """Valid match record matching the football-data.org contract."""
    return {
        "id": 12345,
        "utcDate": "2025-10-15T15:00:00Z",
        "status": "FINISHED",
        "matchday": 8,
        "homeTeam": {"id": 57, "name": "Arsenal"},
        "awayTeam": {"id": 65, "name": "Manchester City"},
        "score": {
            "winner": "HOME_TEAM",
            "fullTime": {"home": 2, "away": 1},
        },
    }


@pytest.fixture
def sample_standing():
    """Valid standing record matching the football-data.org contract."""
    return {
        "position": 1,
        "team": {"id": 57, "name": "Arsenal"},
        "playedGames": 10,
        "won": 8,
        "draw": 1,
        "lost": 1,
        "points": 25,
        "goalsFor": 22,
        "goalsAgainst": 8,
        "goalDifference": 14,
    }
