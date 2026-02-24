#!/usr/bin/env python3
"""Ingest real-time weather data for all 20 EPL stadium locations via Open-Meteo API."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import requests

from log_config import setup_logger

log = setup_logger("ingest_weather")

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "epl_pipeline.duckdb"
STADIUMS_PATH = Path(__file__).resolve().parent / "stadium_coordinates.json"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def load_stadiums() -> list[dict]:
    """Load stadium coordinates from JSON file."""
    with open(STADIUMS_PATH) as f:
        return json.load(f)


def fetch_weather(lat: float, lon: float) -> dict | None:
    """Fetch current weather from Open-Meteo for a single location."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
    }
    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        log.warning("Failed to fetch weather for (%.4f, %.4f): %s", lat, lon, e)
        return None


def ensure_table(conn: duckdb.DuckDBPyConnection) -> None:
    """Create raw.stadium_weather table if it doesn't exist."""
    conn.execute("CREATE SCHEMA IF NOT EXISTS raw")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw.stadium_weather (
            team_name       VARCHAR,
            stadium_name    VARCHAR,
            latitude        DOUBLE,
            longitude       DOUBLE,
            temperature_c   DOUBLE,
            humidity_pct    DOUBLE,
            wind_speed_kmh  DOUBLE,
            precipitation_mm DOUBLE,
            weather_code    INTEGER,
            weather_description VARCHAR,
            fetched_at      TIMESTAMP
        )
    """)


def ingest() -> int:
    """Fetch weather for all stadiums and insert into DuckDB."""
    stadiums = load_stadiums()
    log.info("Fetching weather for %d stadiums...", len(stadiums))

    conn = duckdb.connect(str(DB_PATH))
    ensure_table(conn)

    now = datetime.now(timezone.utc)
    inserted = 0

    for i, stadium in enumerate(stadiums):
        if i > 0:
            time.sleep(0.3)  # Rate limit: ~3 req/sec

        data = fetch_weather(stadium["latitude"], stadium["longitude"])
        if not data or "current" not in data:
            log.warning("No data for %s", stadium["team_name"])
            continue

        current = data["current"]
        weather_code = current.get("weather_code", -1)
        weather_desc = WMO_WEATHER_CODES.get(weather_code, f"Unknown ({weather_code})")

        conn.execute(
            """
            INSERT INTO raw.stadium_weather VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                stadium["team_name"],
                stadium["stadium_name"],
                stadium["latitude"],
                stadium["longitude"],
                current.get("temperature_2m"),
                current.get("relative_humidity_2m"),
                current.get("wind_speed_10m"),
                current.get("precipitation"),
                weather_code,
                weather_desc,
                now,
            ],
        )
        inserted += 1
        log.info("  ✓ %s (%s): %.1f°C, %s", stadium["team_name"], stadium["stadium_name"], current.get("temperature_2m", 0), weather_desc)

    conn.close()
    log.info("Inserted %d/%d weather records", inserted, len(stadiums))
    return inserted


if __name__ == "__main__":
    ingest()
