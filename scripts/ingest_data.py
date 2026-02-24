#!/usr/bin/env python3
"""
EPL Pipeline — Data Ingestion Script
Uses StatsBomb Open Data (free, no API key) to load EPL 2023-24 season data.
Also attempts football-data.org free tier for standings/fixtures.
Stores everything in DuckDB (medallion architecture: raw → staging → mart).
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import duckdb
import pandas as pd
from statsbombpy import sb

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "epl_pipeline.duckdb"
RAW_DIR = DATA_DIR / "raw"
LOG_PREFIX = "[EPL-INGEST]"

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _safe_id(name: str) -> str:
    """Validate and quote a SQL identifier to prevent injection."""
    if not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return f'"{name}"'


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{LOG_PREFIX} [{ts}] {msg}", flush=True)


# ── Database setup ─────────────────────────────────────────────────────────────
def init_db(conn: duckdb.DuckDBPyConnection):
    """Create schema layers: raw, staging, mart"""
    log("Initialising DuckDB schemas…")
    conn.execute("CREATE SCHEMA IF NOT EXISTS raw")
    conn.execute("CREATE SCHEMA IF NOT EXISTS staging")
    conn.execute("CREATE SCHEMA IF NOT EXISTS mart")

    # ── Raw tables ──────────────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw.matches (
            match_id        INTEGER PRIMARY KEY,
            competition_id  INTEGER,
            competition_name VARCHAR,
            season_id       INTEGER,
            season_name     VARCHAR,
            match_date      DATE,
            kick_off        TIME,
            home_team_id    INTEGER,
            home_team_name  VARCHAR,
            away_team_id    INTEGER,
            away_team_name  VARCHAR,
            home_score      INTEGER,
            away_score      INTEGER,
            match_status    VARCHAR,
            matchday        INTEGER,
            raw_json        JSON,
            ingested_at     TIMESTAMP DEFAULT now()
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw.lineups (
            match_id        INTEGER,
            team_id         INTEGER,
            team_name       VARCHAR,
            player_id       INTEGER,
            player_name     VARCHAR,
            jersey_number   INTEGER,
            position_id     INTEGER,
            position_name   VARCHAR,
            raw_json        JSON,
            ingested_at     TIMESTAMP DEFAULT now()
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw.events (
            event_id        VARCHAR PRIMARY KEY,
            match_id        INTEGER,
            index_num       INTEGER,
            period          INTEGER,
            minute          INTEGER,
            second          INTEGER,
            event_type      VARCHAR,
            team_id         INTEGER,
            team_name       VARCHAR,
            player_id       INTEGER,
            player_name     VARCHAR,
            position_name   VARCHAR,
            location_x      FLOAT,
            location_y      FLOAT,
            sub_type        VARCHAR,
            outcome         VARCHAR,
            raw_json        JSON,
            ingested_at     TIMESTAMP DEFAULT now()
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw.player_stats (
            match_id        INTEGER,
            player_id       INTEGER,
            player_name     VARCHAR,
            team_id         INTEGER,
            team_name       VARCHAR,
            minutes_played  INTEGER,
            position_name   VARCHAR,
            raw_json        JSON,
            ingested_at     TIMESTAMP DEFAULT now()
        )
    """)

    log("Schemas and raw tables created ✓")


# ── StatsBomb ingestion ────────────────────────────────────────────────────────
def get_epl_competition():
    """Find EPL (Premier League) in StatsBomb competitions."""
    log("Fetching StatsBomb competitions…")
    comps = sb.competitions()
    # EPL is competition_id 2
    epl = comps[comps["competition_id"] == 2]
    if epl.empty:
        raise ValueError("EPL competition not found in StatsBomb data")
    # Get the latest season available
    seasons = epl.sort_values("season_id", ascending=False)
    log(f"Available EPL seasons:\n{seasons[['competition_id','season_id','season_name']].to_string(index=False)}")
    return seasons


def ingest_matches(conn: duckdb.DuckDBPyConnection, competition_id: int, season_id: int) -> list:
    """Load all matches for a season into raw layer."""
    log(f"Ingesting matches (comp={competition_id}, season={season_id})…")
    matches_df = sb.matches(competition_id=competition_id, season_id=season_id)

    if matches_df.empty:
        log("WARNING: No matches returned!")
        return []

    log(f"  → {len(matches_df)} matches fetched")

    rows = []
    for _, m in matches_df.iterrows():
        row = {
            "match_id": int(m.get("match_id", 0)),
            "competition_id": int(m.get("competition_id", 0)),
            "competition_name": str(m.get("competition", "")),
            "season_id": int(m.get("season_id", 0)),
            "season_name": str(m.get("season", "")),
            "match_date": str(m.get("match_date", "")),
            "kick_off": str(m.get("kick_off", "00:00:00")),
            "home_team_id": int(m.get("home_team_id", 0)) if pd.notna(m.get("home_team_id")) else 0,
            "home_team_name": str(m.get("home_team", "")),
            "away_team_id": int(m.get("away_team_id", 0)) if pd.notna(m.get("away_team_id")) else 0,
            "away_team_name": str(m.get("away_team", "")),
            "home_score": int(m.get("home_score", 0)) if pd.notna(m.get("home_score")) else None,
            "away_score": int(m.get("away_score", 0)) if pd.notna(m.get("away_score")) else None,
            "match_status": str(m.get("match_status", "available")),
            "matchday": int(m.get("match_week", 0)) if pd.notna(m.get("match_week")) else 0,
        }
        rows.append(row)

    if rows:
        # Insert via dataframe
        df = pd.DataFrame(rows)
        df["raw_json"] = df.apply(lambda r: json.dumps(r.to_dict()), axis=1)
        df["ingested_at"] = datetime.utcnow()

        # Use INSERT OR REPLACE pattern
        conn.execute("DELETE FROM raw.matches WHERE competition_id = ? AND season_id = ?",
                     [competition_id, season_id])
        conn.execute("INSERT OR IGNORE INTO raw.matches SELECT * FROM df")
        log(f"  ✓ Loaded {len(rows)} matches to raw.matches")

    return [r["match_id"] for r in rows]


def ingest_events_sample(conn: duckdb.DuckDBPyConnection, match_ids: list, sample_size: int = 50):
    """Load events for a sample of matches (events data is large)."""
    log(f"Ingesting events for {min(sample_size, len(match_ids))} matches…")
    sample = match_ids[:sample_size]

    all_events = []
    for i, match_id in enumerate(sample):
        try:
            events_df = sb.events(match_id=match_id)
            if events_df.empty:
                continue

            # Extract key event info
            for _, e in events_df.iterrows():
                location = e.get("location", None)
                loc_x, loc_y = None, None
                if isinstance(location, list) and len(location) >= 2:
                    loc_x, loc_y = float(location[0]), float(location[1])

                row = {
                    "event_id": str(e.get("id", "")),
                    "match_id": match_id,
                    "index_num": int(e.get("index", 0)),
                    "period": int(e.get("period", 0)),
                    "minute": int(e.get("minute", 0)),
                    "second": int(e.get("second", 0)),
                    "event_type": str(e.get("type", "")),
                    "team_id": int(e.get("team_id", 0)) if pd.notna(e.get("team_id")) else 0,
                    "team_name": str(e.get("team", "")),
                    "player_id": int(e.get("player_id", 0)) if pd.notna(e.get("player_id")) else None,
                    "player_name": str(e.get("player", "")) if pd.notna(e.get("player")) else None,
                    "position_name": str(e.get("position", "")) if pd.notna(e.get("position")) else None,
                    "location_x": loc_x,
                    "location_y": loc_y,
                    "sub_type": str(e.get("pass_type", e.get("shot_type", ""))) if pd.notna(e.get("pass_type", e.get("shot_type", None))) else None,
                    "outcome": str(e.get("shot_outcome", e.get("pass_outcome", ""))) if pd.notna(e.get("shot_outcome", e.get("pass_outcome", None))) else None,
                }
                all_events.append(row)

            if (i + 1) % 10 == 0:
                log(f"  → Processed {i+1}/{len(sample)} matches")

        except Exception as ex:
            log(f"  WARNING: Failed to load events for match {match_id}: {ex}")
            continue

    if all_events:
        df = pd.DataFrame(all_events)
        df["raw_json"] = "{}"
        df["ingested_at"] = datetime.utcnow()
        # Drop duplicates on event_id
        df = df.drop_duplicates(subset=["event_id"])
        existing = conn.execute("SELECT event_id FROM raw.events").df()
        if not existing.empty:
            df = df[~df["event_id"].isin(existing["event_id"])]
        if not df.empty:
            conn.execute("INSERT OR IGNORE INTO raw.events SELECT * FROM df")
        log(f"  ✓ Loaded {len(all_events)} events to raw.events")
    else:
        log("  WARNING: No events loaded")


def ingest_lineups(conn: duckdb.DuckDBPyConnection, match_ids: list, sample_size: int = 100):
    """Load lineups for matches."""
    log(f"Ingesting lineups for {min(sample_size, len(match_ids))} matches…")
    sample = match_ids[:sample_size]
    all_rows = []

    for i, match_id in enumerate(sample):
        try:
            lineups = sb.lineups(match_id=match_id)
            for team_name, lineup_df in lineups.items():
                for _, p in lineup_df.iterrows():
                    positions = p.get("positions", [])
                    pos_id, pos_name = None, None
                    if positions:
                        first_pos = positions[0] if isinstance(positions, list) else {}
                        pos_id = first_pos.get("position_id")
                        pos_name = first_pos.get("position")

                    row = {
                        "match_id": match_id,
                        "team_id": int(p.get("team_id", 0)) if pd.notna(p.get("team_id")) else 0,
                        "team_name": team_name,
                        "player_id": int(p.get("player_id", 0)),
                        "player_name": str(p.get("player_name", "")),
                        "jersey_number": int(p.get("jersey_number", 0)) if pd.notna(p.get("jersey_number")) else 0,
                        "position_id": int(pos_id) if pos_id and pd.notna(pos_id) else None,
                        "position_name": pos_name,
                    }
                    all_rows.append(row)
        except Exception as ex:
            log(f"  WARNING: Failed to load lineup for match {match_id}: {ex}")
            continue

    if all_rows:
        df = pd.DataFrame(all_rows)
        df["raw_json"] = "{}"
        df["ingested_at"] = datetime.utcnow()
        conn.execute("DELETE FROM raw.lineups WHERE match_id IN (SELECT DISTINCT match_id FROM df)")
        conn.execute("DELETE FROM raw.lineups WHERE match_id IN (SELECT DISTINCT match_id FROM df)")
        conn.execute("INSERT INTO raw.lineups SELECT * FROM df")
        log(f"  ✓ Loaded {len(all_rows)} lineup rows to raw.lineups")


def build_player_stats_from_events(conn: duckdb.DuckDBPyConnection):
    """Derive player stats from events data."""
    log("Building player stats from events…")
    conn.execute("""
        CREATE OR REPLACE TABLE raw.player_stats AS
        SELECT
            match_id,
            player_id,
            player_name,
            team_id,
            team_name,
            position_name,
            -- count appearances
            COUNT(DISTINCT event_id) AS event_count,
            '{}' AS raw_json,
            now() AS ingested_at
        FROM raw.events
        WHERE player_id IS NOT NULL
        GROUP BY match_id, player_id, player_name, team_id, team_name, position_name
    """)
    cnt = conn.execute("SELECT COUNT(*) FROM raw.player_stats").fetchone()[0]
    log(f"  ✓ player_stats built: {cnt} rows")


# ── Staging transforms ─────────────────────────────────────────────────────────
def build_staging(conn: duckdb.DuckDBPyConnection):
    """Transform raw → staging layer (cleaned, deduplicated)."""
    log("Building staging layer…")

    # stg_matches
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_matches AS
        SELECT
            match_id,
            competition_id,
            competition_name,
            season_id,
            season_name,
            TRY_CAST(match_date AS DATE) AS match_date,
            home_team_id,
            home_team_name,
            away_team_id,
            away_team_name,
            home_score,
            away_score,
            CASE
                WHEN home_score > away_score THEN 'HOME_TEAM'
                WHEN away_score > home_score THEN 'AWAY_TEAM'
                WHEN home_score = away_score THEN 'DRAW'
                ELSE NULL
            END AS winner,
            match_status,
            matchday,
            ingested_at
        FROM raw.matches
        WHERE match_status = 'available'
    """)

    # stg_standings — derived from match results
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_standings AS
        WITH all_results AS (
            SELECT home_team_id AS team_id, home_team_name AS team_name,
                   home_score AS gf, away_score AS ga,
                   CASE WHEN home_score > away_score THEN 3
                        WHEN home_score = away_score THEN 1
                        ELSE 0 END AS pts,
                   CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS won,
                   CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS drawn,
                   CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS lost
            FROM staging.stg_matches WHERE home_score IS NOT NULL
            UNION ALL
            SELECT away_team_id AS team_id, away_team_name AS team_name,
                   away_score AS gf, home_score AS ga,
                   CASE WHEN away_score > home_score THEN 3
                        WHEN away_score = home_score THEN 1
                        ELSE 0 END AS pts,
                   CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS won,
                   CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS drawn,
                   CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS lost
            FROM staging.stg_matches WHERE away_score IS NOT NULL
        )
        SELECT
            team_id,
            team_name,
            COUNT(*) AS played,
            SUM(won)   AS won,
            SUM(drawn) AS drawn,
            SUM(lost)  AS lost,
            SUM(pts)   AS points,
            SUM(gf)    AS goals_for,
            SUM(ga)    AS goals_against,
            SUM(gf) - SUM(ga) AS goal_difference
        FROM all_results
        GROUP BY team_id, team_name
        ORDER BY points DESC, goal_difference DESC, goals_for DESC
    """)

    # stg_top_scorers — derived from events
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_top_scorers AS
        SELECT
            player_id,
            player_name,
            team_id,
            team_name,
            COUNT(CASE WHEN event_type = 'Shot' AND outcome = 'Goal' THEN 1 END) AS goals,
            COUNT(CASE WHEN event_type = 'Pass' AND outcome = 'Goal' THEN 1 END) AS assists
        FROM raw.events
        WHERE player_id IS NOT NULL
        GROUP BY player_id, player_name, team_id, team_name
        HAVING COUNT(CASE WHEN event_type = 'Shot' AND outcome = 'Goal' THEN 1 END) > 0
        ORDER BY goals DESC, assists DESC
    """)

    # stg_events
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_events AS
        SELECT * FROM raw.events
    """)

    # stg_lineups
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_lineups AS
        SELECT
            match_id,
            team_id,
            team_name,
            player_id,
            player_name,
            jersey_number,
            position_name
        FROM raw.lineups
    """)

    log("  ✓ Staging views created")


# ── Mart (gold) transforms ─────────────────────────────────────────────────────
def build_mart(conn: duckdb.DuckDBPyConnection):
    """Build gold layer mart tables for dashboard consumption."""
    log("Building mart layer…")

    # mart_league_table
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_league_table AS
        SELECT
            ROW_NUMBER() OVER (ORDER BY points DESC, goal_difference DESC, goals_for DESC) AS position,
            team_id,
            team_name,
            played,
            won,
            drawn,
            lost,
            points,
            goals_for,
            goals_against,
            goal_difference,
            ROUND(CAST(won AS DOUBLE) / NULLIF(played, 0) * 100, 1) AS win_rate,
            ROUND(CAST(points AS DOUBLE) / NULLIF(played * 3, 0) * 100, 1) AS points_pct,
            ROUND(CAST(goals_for AS DOUBLE) / NULLIF(played, 0), 2) AS goals_per_game,
            ROUND(CAST(goals_against AS DOUBLE) / NULLIF(played, 0), 2) AS goals_conceded_per_game
        FROM staging.stg_standings
    """)

    # mart_recent_results
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_recent_results AS
        SELECT
            m.match_id,
            m.matchday,
            m.match_date,
            m.home_team_id,
            m.home_team_name,
            m.away_team_id,
            m.away_team_name,
            m.home_score,
            m.away_score,
            m.winner,
            m.match_status,
            -- home result
            CASE WHEN m.winner = 'HOME_TEAM' THEN 'W'
                 WHEN m.winner = 'DRAW' THEN 'D'
                 WHEN m.winner = 'AWAY_TEAM' THEN 'L'
                 ELSE NULL END AS home_result,
            -- away result
            CASE WHEN m.winner = 'AWAY_TEAM' THEN 'W'
                 WHEN m.winner = 'DRAW' THEN 'D'
                 WHEN m.winner = 'HOME_TEAM' THEN 'L'
                 ELSE NULL END AS away_result
        FROM staging.stg_matches m
        ORDER BY m.match_date DESC, m.matchday DESC
    """)

    # mart_top_scorers (from events)
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_top_scorers AS
        WITH scorer_stats AS (
            SELECT
                e.player_id,
                e.player_name,
                e.team_name,
                COUNT(CASE WHEN e.event_type = 'Shot' AND e.outcome = 'Goal' THEN 1 END) AS goals,
                COUNT(DISTINCT e.match_id) AS matches_played
            FROM raw.events e
            WHERE e.player_id IS NOT NULL
            GROUP BY e.player_id, e.player_name, e.team_name
        ),
        assist_stats AS (
            SELECT
                player_id,
                COUNT(*) AS assists
            FROM raw.events
            WHERE event_type = 'Pass'
              AND outcome = 'Goal'
              AND player_id IS NOT NULL
            GROUP BY player_id
        )
        SELECT
            s.player_id,
            s.player_name,
            s.team_name,
            s.goals,
            COALESCE(a.assists, 0) AS assists,
            s.goals + COALESCE(a.assists, 0) AS goal_contributions,
            s.matches_played,
            ROUND(CAST(s.goals AS DOUBLE) / NULLIF(s.matches_played, 0), 2) AS goals_per_game,
            ROW_NUMBER() OVER (ORDER BY s.goals DESC, COALESCE(a.assists, 0) DESC) AS rank
        FROM scorer_stats s
        LEFT JOIN assist_stats a ON s.player_id = a.player_id
        WHERE s.goals > 0
        ORDER BY s.goals DESC, COALESCE(a.assists, 0) DESC
    """)

    # mart_team_stats
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_team_stats AS
        SELECT
            lt.*,
            -- recent form (last 5 home + away matches)
            (SELECT COUNT(*) FROM mart.mart_recent_results rr
             WHERE (rr.home_team_id = lt.team_id AND rr.home_result = 'W')
                OR (rr.away_team_id = lt.team_id AND rr.away_result = 'W')) AS total_wins,
            (SELECT COUNT(*) FROM mart.mart_recent_results rr
             WHERE rr.home_team_id = lt.team_id OR rr.away_team_id = lt.team_id) AS total_matches
        FROM mart.mart_league_table lt
    """)

    # mart_match_events — for match detail page
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_match_events AS
        SELECT
            e.event_id,
            e.match_id,
            e.period,
            e.minute,
            e.second,
            e.event_type,
            e.player_name,
            e.team_name,
            e.position_name,
            e.location_x,
            e.location_y,
            e.sub_type,
            e.outcome,
            m.home_team_name,
            m.away_team_name,
            m.home_score,
            m.away_score,
            m.match_date
        FROM raw.events e
        JOIN staging.stg_matches m ON e.match_id = m.match_id
        ORDER BY e.match_id, e.period, e.minute, e.second
    """)

    # Row counts
    tables = ["mart_league_table", "mart_recent_results", "mart_top_scorers",
              "mart_team_stats", "mart_match_events"]
    for t in tables:
        cnt = conn.execute(f"SELECT COUNT(*) FROM {_safe_id('mart')}.{_safe_id(t)}").fetchone()[0]
        log(f"  ✓ mart.{t}: {cnt} rows")


# ── Export to JSON for dashboard ───────────────────────────────────────────────
def export_json(conn: duckdb.DuckDBPyConnection):
    """Export mart tables to JSON files for dashboard consumption."""
    log("Exporting mart data to JSON…")
    json_dir = DATA_DIR / "json"
    json_dir.mkdir(parents=True, exist_ok=True)

    exports = {
        "league_table": "SELECT * FROM mart.mart_league_table ORDER BY position",
        "recent_results": "SELECT * FROM mart.mart_recent_results ORDER BY match_date DESC LIMIT 200",
        "top_scorers": "SELECT * FROM mart.mart_top_scorers ORDER BY rank LIMIT 30",
        "team_stats": "SELECT * FROM mart.mart_team_stats ORDER BY position",
        "matches": "SELECT match_id, matchday, match_date, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score, winner FROM mart.mart_recent_results ORDER BY matchday, match_date",
    }

    for name, query in exports.items():
        df = conn.execute(query).df()
        out_path = json_dir / f"{name}.json"
        df.to_json(out_path, orient="records", indent=2, date_format="iso")
        log(f"  ✓ Exported {name}.json ({len(df)} records)")

    # Export match events per match
    matches = conn.execute("SELECT DISTINCT match_id FROM mart.mart_match_events").df()
    events_dir = json_dir / "match_events"
    events_dir.mkdir(exist_ok=True)
    for match_id in matches["match_id"]:
        df = conn.execute(
            "SELECT * FROM mart.mart_match_events WHERE match_id = ?", [match_id]
        ).df()
        df.to_json(events_dir / f"{match_id}.json", orient="records", indent=2)
    log(f"  ✓ Exported {len(matches)} match event files")

    # Export team pages
    teams = conn.execute("SELECT DISTINCT team_id, team_name FROM mart.mart_league_table").df()
    teams_dir = json_dir / "teams"
    teams_dir.mkdir(exist_ok=True)
    for _, team in teams.iterrows():
        team_id = team["team_id"]
        team_name = team["team_name"]
        # Get team's matches
        t_matches = conn.execute("""
            SELECT * FROM mart.mart_recent_results
            WHERE home_team_id = ? OR away_team_id = ?
            ORDER BY match_date DESC
        """, [team_id, team_id]).df()
        # Get team standings
        t_table = conn.execute(
            "SELECT * FROM mart.mart_league_table WHERE team_id = ?", [team_id]
        ).df()
        team_data = {
            "team_id": int(team_id),
            "team_name": team_name,
            "standings": t_table.to_dict(orient="records")[0] if not t_table.empty else {},
            "matches": t_matches.to_dict(orient="records"),
        }
        out_path = teams_dir / f"{team_id}.json"
        with open(out_path, "w") as f:
            json.dump(team_data, f, indent=2, default=str)
    log(f"  ✓ Exported {len(teams)} team files")

    log(f"  ✓ All JSON exports complete → {json_dir}")


# ── Data quality checks ────────────────────────────────────────────────────────
def run_quality_checks(conn: duckdb.DuckDBPyConnection):
    """Basic data quality assertions."""
    log("Running data quality checks…")
    checks = [
        ("raw.matches has rows", "SELECT COUNT(*) FROM raw.matches", lambda n: n > 0),
        ("20 teams in league table", "SELECT COUNT(*) FROM mart.mart_league_table", lambda n: n == 20),
        ("No null team_id", "SELECT COUNT(*) FROM mart.mart_league_table WHERE team_id IS NULL", lambda n: n == 0),
        ("Points >= 0", "SELECT COUNT(*) FROM mart.mart_league_table WHERE points < 0", lambda n: n == 0),
        ("Played >= won+drawn+lost", """
            SELECT COUNT(*) FROM mart.mart_league_table
            WHERE played != won + drawn + lost
        """, lambda n: n == 0),
    ]

    passed = failed = 0
    for name, query, check_fn in checks:
        result = conn.execute(query).fetchone()[0]
        ok = check_fn(result)
        status = "✓ PASS" if ok else "✗ FAIL"
        log(f"  {status}: {name} (value={result})")
        if ok:
            passed += 1
        else:
            failed += 1

    log(f"Quality checks: {passed} passed, {failed} failed")
    return failed == 0


# ── Main entry point ────────────────────────────────────────────────────────────
def main():
    # Setup directories
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "json").mkdir(parents=True, exist_ok=True)

    log("=" * 60)
    log("EPL PIPELINE — DATA INGESTION")
    log(f"Database: {DB_PATH}")
    log("=" * 60)

    # Connect to DuckDB
    conn = duckdb.connect(str(DB_PATH))

    try:
        # 1. Init DB
        init_db(conn)

        # 2. Find EPL competition
        seasons = get_epl_competition()

        # Target: 2023-24 season (season_id=281) or most recent
        TARGET_SEASON_ID = None
        for _, row in seasons.iterrows():
            if "2023/2024" in str(row.get("season_name", "")) or row.get("season_id") == 281:
                TARGET_SEASON_ID = int(row["season_id"])
                TARGET_SEASON_NAME = str(row["season_name"])
                break

        if TARGET_SEASON_ID is None:
            # Use the most recent season available
            row = seasons.iloc[0]
            TARGET_SEASON_ID = int(row["season_id"])
            TARGET_SEASON_NAME = str(row["season_name"])

        log(f"Target season: {TARGET_SEASON_NAME} (id={TARGET_SEASON_ID})")
        COMPETITION_ID = 2  # EPL

        # 3. Ingest matches
        match_ids = ingest_matches(conn, COMPETITION_ID, TARGET_SEASON_ID)
        total_matches = len(match_ids)
        log(f"Total matches available: {total_matches}")

        if total_matches == 0:
            log("ERROR: No matches found! Cannot continue.")
            sys.exit(1)

        # 4. Ingest events (sample — all matches for full dataset, but cap for speed)
        sample_size = min(total_matches, 380)  # Full season = 380 matches
        ingest_events_sample(conn, match_ids, sample_size=sample_size)

        # 5. Ingest lineups
        ingest_lineups(conn, match_ids, sample_size=min(total_matches, 380))

        # 6. Build player stats from events
        build_player_stats_from_events(conn)

        # 7. Build staging
        build_staging(conn)

        # 8. Build mart
        build_mart(conn)

        # 9. Data quality checks
        run_quality_checks(conn)

        # 10. Export JSON
        export_json(conn)

        log("=" * 60)
        log("✅ INGESTION COMPLETE")
        log(f"   Database: {DB_PATH}")
        log(f"   JSON exports: {DATA_DIR / 'json'}")
        log("=" * 60)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
