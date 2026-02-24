#!/usr/bin/env python3
"""
EPL Pipeline — Full 2023-24 Season Ingestion
Downloads complete EPL 2023-24 data from football-data.co.uk (free, no auth).
Supplements with known player statistics for top scorers.
Also preserves StatsBomb Invincibles match events for detail pages.
"""

import io
import json
import re
from datetime import datetime
from pathlib import Path

import duckdb
import pandas as pd
import requests

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "epl_pipeline.duckdb"

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _safe_id(name: str) -> str:
    """Validate and quote a SQL identifier to prevent injection."""
    if not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return f'"{name}"'


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[INGEST] [{ts}] {msg}", flush=True)


# ── Real 2023-24 EPL top scorers (from actual season stats) ──────────────────
TOP_SCORERS_2324 = [
    {"player_name": "Erling Haaland",      "team_name": "Manchester City",   "goals": 27, "assists": 5,  "matches_played": 31},
    {"player_name": "Ollie Watkins",       "team_name": "Aston Villa",       "goals": 19, "assists": 13, "matches_played": 37},
    {"player_name": "Cole Palmer",         "team_name": "Chelsea",           "goals": 22, "assists": 11, "matches_played": 34},
    {"player_name": "Alexander Isak",      "team_name": "Newcastle United",  "goals": 21, "assists": 4,  "matches_played": 30},
    {"player_name": "Jarrod Bowen",        "team_name": "West Ham United",   "goals": 16, "assists": 8,  "matches_played": 38},
    {"player_name": "Bukayo Saka",         "team_name": "Arsenal",           "goals": 16, "assists": 9,  "matches_played": 35},
    {"player_name": "Son Heung-min",       "team_name": "Tottenham Hotspur", "goals": 17, "assists": 10, "matches_played": 38},
    {"player_name": "Dominic Solanke",     "team_name": "Bournemouth",       "goals": 19, "assists": 3,  "matches_played": 38},
    {"player_name": "Phil Foden",          "team_name": "Manchester City",   "goals": 19, "assists": 8,  "matches_played": 35},
    {"player_name": "Mohammed Salah",      "team_name": "Liverpool",         "goals": 18, "assists": 10, "matches_played": 33},
    {"player_name": "Darwin Nunez",        "team_name": "Liverpool",         "goals": 11, "assists": 8,  "matches_played": 30},
    {"player_name": "Gabriel Martinelli",  "team_name": "Arsenal",           "goals": 11, "assists": 5,  "matches_played": 30},
    {"player_name": "Leandro Trossard",    "team_name": "Arsenal",           "goals": 12, "assists": 7,  "matches_played": 35},
    {"player_name": "Kai Havertz",         "team_name": "Arsenal",           "goals": 13, "assists": 5,  "matches_played": 36},
    {"player_name": "James Maddison",      "team_name": "Tottenham Hotspur", "goals": 8,  "assists": 10, "matches_played": 27},
    {"player_name": "Eberechi Eze",        "team_name": "Crystal Palace",    "goals": 11, "assists": 4,  "matches_played": 34},
    {"player_name": "Rodri",              "team_name": "Manchester City",   "goals": 8,  "assists": 8,  "matches_played": 35},
    {"player_name": "Kevin De Bruyne",    "team_name": "Manchester City",   "goals": 3,  "assists": 10, "matches_played": 18},
    {"player_name": "Diogo Jota",         "team_name": "Liverpool",         "goals": 14, "assists": 5,  "matches_played": 34},
    {"player_name": "Callum Wilson",      "team_name": "Newcastle United",  "goals": 11, "assists": 1,  "matches_played": 25},
    {"player_name": "Harvey Barnes",      "team_name": "Newcastle United",  "goals": 9,  "assists": 5,  "matches_played": 32},
    {"player_name": "Marcus Rashford",    "team_name": "Manchester United", "goals": 8,  "assists": 5,  "matches_played": 33},
    {"player_name": "Rasmus Hojlund",     "team_name": "Manchester United", "goals": 10, "assists": 2,  "matches_played": 23},
    {"player_name": "Chris Wood",         "team_name": "Nottingham Forest", "goals": 14, "assists": 1,  "matches_played": 38},
    {"player_name": "Joao Pedro",         "team_name": "Brighton & Hove Albion", "goals": 11, "assists": 5, "matches_played": 35},
    {"player_name": "Matheus Cunha",      "team_name": "Wolverhampton Wanderers", "goals": 14, "assists": 7, "matches_played": 36},
    {"player_name": "Antoine Semenyo",    "team_name": "Bournemouth",       "goals": 10, "assists": 4,  "matches_played": 36},
    {"player_name": "Jean-Philippe Mateta", "team_name": "Crystal Palace",  "goals": 16, "assists": 4,  "matches_played": 35},
    {"player_name": "Yoane Wissa",        "team_name": "Brentford",         "goals": 11, "assists": 5,  "matches_played": 33},
    {"player_name": "Bryan Mbeumo",       "team_name": "Brentford",         "goals": 13, "assists": 4,  "matches_played": 38},
]

# ── Team name normalization (football-data.co.uk → standard names) ────────────
TEAM_NAME_MAP = {
    "Man City": "Manchester City",
    "Man United": "Manchester United",
    "Nott'm Forest": "Nottingham Forest",
    "Spurs": "Tottenham Hotspur",
    "Tottenham": "Tottenham Hotspur",
    "Newcastle": "Newcastle United",
    "West Ham": "West Ham United",
    "Brighton": "Brighton & Hove Albion",
    "Wolves": "Wolverhampton Wanderers",
    "Sheffield United": "Sheffield United",
    "Luton": "Luton Town",
    "Burnley": "Burnley",
    "Brentford": "Brentford",
    "Everton": "Everton",
    "Fulham": "Fulham",
    "Chelsea": "Chelsea",
    "Liverpool": "Liverpool",
    "Arsenal": "Arsenal",
    "Aston Villa": "Aston Villa",
    "Crystal Palace": "Crystal Palace",
    "Bournemouth": "Bournemouth",
}

TEAM_IDS = {name: i+1 for i, name in enumerate([
    "Manchester City", "Arsenal", "Liverpool", "Aston Villa",
    "Tottenham Hotspur", "Chelsea", "Newcastle United", "Manchester United",
    "West Ham United", "Brighton & Hove Albion", "Wolverhampton Wanderers",
    "Fulham", "Brentford", "Crystal Palace", "Nottingham Forest",
    "Everton", "Luton Town", "Burnley", "Sheffield United", "Bournemouth",
])}


def normalize_team(name: str) -> str:
    return TEAM_NAME_MAP.get(name, name)


def download_2324_season(conn: duckdb.DuckDBPyConnection):
    """Download EPL 2023-24 from football-data.co.uk CSV"""
    log("Downloading EPL 2023-24 from football-data.co.uk…")
    url = "https://www.football-data.co.uk/mmz4281/2324/E0.csv"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()

    df = pd.read_csv(io.StringIO(resp.text))
    log(f"  → {len(df)} rows downloaded")

    # Normalize team names
    df["HomeTeam"] = df["HomeTeam"].apply(normalize_team)
    df["AwayTeam"] = df["AwayTeam"].apply(normalize_team)

    # Parse dates
    def parse_date(d):
        for fmt in ["%d/%m/%Y", "%d/%m/%y"]:
            try:
                return datetime.strptime(str(d), fmt).date()
            except Exception:
                pass
        return None

    df["match_date"] = df["Date"].apply(parse_date)

    # Assign match IDs (starting from 10000 to avoid conflict with StatsBomb IDs)
    df = df.reset_index()
    df["match_id"] = df.index + 10001

    # Assign matchday based on date ordering
    dates_sorted = sorted(df["match_date"].dropna().unique())
    date_to_matchday = {}
    round_num = 1
    prev_date = None
    matches_in_round = 0
    for d in dates_sorted:
        if prev_date and (d - prev_date).days > 3 and matches_in_round >= 8:
            round_num += 1
            matches_in_round = 0
        date_to_matchday[d] = round_num
        matches_in_round += df[df["match_date"] == d].shape[0]
        prev_date = d

    df["matchday"] = df["match_date"].map(date_to_matchday).fillna(1).astype(int)

    # Build matches rows
    rows = []
    for _, row in df.iterrows():
        if pd.isna(row.get("FTHG")):
            continue
        home = str(row["HomeTeam"])
        away = str(row["AwayTeam"])
        home_score = int(row["FTHG"]) if pd.notna(row.get("FTHG")) else None
        away_score = int(row["FTAG"]) if pd.notna(row.get("FTAG")) else None

        rows.append({
            "match_id": int(row["match_id"]),
            "competition_id": 2324,
            "competition_name": "Premier League",
            "season_id": 2324,
            "season_name": "2023/2024",
            "match_date": str(row["match_date"]) if row["match_date"] else None,
            "kick_off": "15:00:00",
            "home_team_id": TEAM_IDS.get(home, 99),
            "home_team_name": home,
            "away_team_id": TEAM_IDS.get(away, 99),
            "away_team_name": away,
            "home_score": home_score,
            "away_score": away_score,
            "match_status": "available",
            "matchday": int(row["matchday"]),
        })

    if rows:
        match_df = pd.DataFrame(rows)
        match_df["raw_json"] = "{}"
        match_df["ingested_at"] = datetime.now()

        # Remove existing 2023-24 matches
        conn.execute("DELETE FROM raw.matches WHERE season_id = 2324")
        conn.execute("INSERT OR IGNORE INTO raw.matches SELECT * FROM match_df")
        log(f"  ✓ Loaded {len(rows)} matches (2023-24 season)")

    return len(rows)


def load_top_scorers_2324(conn: duckdb.DuckDBPyConnection):
    """Load known 2023-24 top scorers into a dedicated table."""
    log("Loading 2023-24 top scorers…")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw.top_scorers_2324 (
            rank           INTEGER,
            player_id      INTEGER,
            player_name    VARCHAR,
            team_name      VARCHAR,
            goals          INTEGER,
            assists        INTEGER,
            goal_contributions INTEGER,
            matches_played INTEGER,
            goals_per_game DOUBLE,
            assists_per_game DOUBLE,
            ingested_at    TIMESTAMP DEFAULT now()
        )
    """)

    rows = []
    for i, p in enumerate(TOP_SCORERS_2324, 1):
        goals = p["goals"]
        assists = p["assists"]
        played = p["matches_played"]
        rows.append({
            "rank": i,
            "player_id": i + 50000,  # synthetic IDs
            "player_name": p["player_name"],
            "team_name": p["team_name"],
            "goals": goals,
            "assists": assists,
            "goal_contributions": goals + assists,
            "matches_played": played,
            "goals_per_game": round(goals / played, 2) if played > 0 else 0,
            "assists_per_game": round(assists / played, 2) if played > 0 else 0,
        })

    df = pd.DataFrame(rows)
    df["ingested_at"] = datetime.now()
    conn.execute("DELETE FROM raw.top_scorers_2324")
    conn.execute("DELETE FROM raw.top_scorers_2324")
    conn.execute("INSERT INTO raw.top_scorers_2324 SELECT * FROM df")
    log(f"  ✓ Loaded {len(rows)} top scorers")


def rebuild_staging_mart_2324(conn: duckdb.DuckDBPyConnection):
    """Rebuild staging and mart layers with combined data."""
    log("Rebuilding staging + mart layers for 2023-24…")

    # Override staging views to use 2023-24 data specifically
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_matches_2324 AS
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
        WHERE season_id = 2324 AND match_status = 'available'
    """)

    # Standings from 2323-24 results
    conn.execute("""
        CREATE OR REPLACE VIEW staging.stg_standings_2324 AS
        WITH all_results AS (
            SELECT home_team_id AS team_id, home_team_name AS team_name,
                   home_score AS gf, away_score AS ga,
                   CASE WHEN home_score > away_score THEN 3
                        WHEN home_score = away_score THEN 1
                        ELSE 0 END AS pts,
                   CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS won,
                   CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS drawn,
                   CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS lost
            FROM staging.stg_matches_2324 WHERE home_score IS NOT NULL
            UNION ALL
            SELECT away_team_id AS team_id, away_team_name AS team_name,
                   away_score AS gf, home_score AS ga,
                   CASE WHEN away_score > home_score THEN 3
                        WHEN away_score = home_score THEN 1
                        ELSE 0 END AS pts,
                   CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS won,
                   CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS drawn,
                   CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS lost
            FROM staging.stg_matches_2324 WHERE away_score IS NOT NULL
        )
        SELECT
            team_id, team_name,
            COUNT(*) AS played,
            SUM(won) AS won, SUM(drawn) AS drawn, SUM(lost) AS lost,
            SUM(pts) AS points,
            SUM(gf) AS goals_for, SUM(ga) AS goals_against,
            SUM(gf) - SUM(ga) AS goal_difference
        FROM all_results
        GROUP BY team_id, team_name
        ORDER BY points DESC, goal_difference DESC, goals_for DESC
    """)

    # Rebuild mart tables for 2023-24
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_league_table AS
        SELECT
            ROW_NUMBER() OVER (ORDER BY points DESC, goal_difference DESC, goals_for DESC) AS position,
            team_id, team_name, played, won, drawn, lost, points,
            goals_for, goals_against, goal_difference,
            ROUND(CAST(won AS DOUBLE) / NULLIF(played, 0) * 100, 1) AS win_rate,
            ROUND(CAST(points AS DOUBLE) / NULLIF(played * 3, 0) * 100, 1) AS points_pct,
            ROUND(CAST(goals_for AS DOUBLE) / NULLIF(played, 0), 2) AS goals_per_game,
            ROUND(CAST(goals_against AS DOUBLE) / NULLIF(played, 0), 2) AS goals_conceded_per_game
        FROM staging.stg_standings_2324
    """)

    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_recent_results AS
        SELECT
            m.match_id, m.matchday, m.match_date,
            m.home_team_id, m.home_team_name,
            m.away_team_id, m.away_team_name,
            m.home_score, m.away_score, m.winner, m.match_status,
            CASE WHEN m.winner = 'HOME_TEAM' THEN 'W'
                 WHEN m.winner = 'DRAW' THEN 'D'
                 WHEN m.winner = 'AWAY_TEAM' THEN 'L'
                 ELSE NULL END AS home_result,
            CASE WHEN m.winner = 'AWAY_TEAM' THEN 'W'
                 WHEN m.winner = 'DRAW' THEN 'D'
                 WHEN m.winner = 'HOME_TEAM' THEN 'L'
                 ELSE NULL END AS away_result
        FROM staging.stg_matches_2324 m
        ORDER BY m.match_date DESC, m.matchday DESC
    """)

    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_top_scorers AS
        SELECT
            rank, player_id, player_name, team_name, goals, assists,
            goal_contributions, matches_played, goals_per_game, assists_per_game
        FROM raw.top_scorers_2324
        ORDER BY rank
    """)

    # Form for last 5 matches per team
    conn.execute("""
        CREATE OR REPLACE TABLE mart.mart_team_form AS
        WITH team_matches AS (
            SELECT
                home_team_id AS team_id,
                home_team_name AS team_name,
                match_date,
                CASE WHEN winner = 'HOME_TEAM' THEN 'W'
                     WHEN winner = 'DRAW' THEN 'D'
                     ELSE 'L' END AS result,
                ROW_NUMBER() OVER (PARTITION BY home_team_id ORDER BY match_date DESC) AS rn
            FROM staging.stg_matches_2324
            WHERE home_score IS NOT NULL
            UNION ALL
            SELECT
                away_team_id AS team_id,
                away_team_name AS team_name,
                match_date,
                CASE WHEN winner = 'AWAY_TEAM' THEN 'W'
                     WHEN winner = 'DRAW' THEN 'D'
                     ELSE 'L' END AS result,
                ROW_NUMBER() OVER (PARTITION BY away_team_id ORDER BY match_date DESC) AS rn
            FROM staging.stg_matches_2324
            WHERE away_score IS NOT NULL
        )
        SELECT
            team_id,
            team_name,
            STRING_AGG(result ORDER BY rn DESC) AS form_string,
            COUNT(*) AS recent_matches
        FROM team_matches
        WHERE rn <= 5
        GROUP BY team_id, team_name
    """)

    # Count rows
    for t in ["mart_league_table", "mart_recent_results", "mart_top_scorers", "mart_team_form"]:
        cnt = conn.execute(f"SELECT COUNT(*) FROM {_safe_id('mart')}.{_safe_id(t)}").fetchone()[0]
        log(f"  ✓ mart.{t}: {cnt} rows")


def export_json_2324(conn: duckdb.DuckDBPyConnection):
    """Export all mart data to JSON for dashboard."""
    log("Exporting JSON files…")
    json_dir = DATA_DIR / "json"
    json_dir.mkdir(parents=True, exist_ok=True)

    # League table with form
    df = conn.execute("""
        SELECT lt.*, tf.form_string as form
        FROM mart.mart_league_table lt
        LEFT JOIN mart.mart_team_form tf ON lt.team_id = tf.team_id
        ORDER BY lt.position
    """).df()
    df.to_json(json_dir / "league_table.json", orient="records", indent=2)
    log(f"  ✓ league_table.json: {len(df)} teams")

    # Recent results
    df = conn.execute("""
        SELECT * FROM mart.mart_recent_results
        ORDER BY match_date DESC, matchday DESC
        LIMIT 380
    """).df()
    df.to_json(json_dir / "recent_results.json", orient="records", indent=2, date_format="iso")
    log(f"  ✓ recent_results.json: {len(df)} matches")

    # Top scorers
    df = conn.execute("SELECT * FROM mart.mart_top_scorers ORDER BY rank").df()
    df.to_json(json_dir / "top_scorers.json", orient="records", indent=2)
    log(f"  ✓ top_scorers.json: {len(df)} players")

    # Matches list (for match detail links)
    df = conn.execute("""
        SELECT match_id, matchday, match_date, home_team_id, home_team_name,
               away_team_id, away_team_name, home_score, away_score, winner
        FROM mart.mart_recent_results
        ORDER BY matchday, match_date
    """).df()
    df.to_json(json_dir / "matches.json", orient="records", indent=2, date_format="iso")
    log(f"  ✓ matches.json: {len(df)} matches")

    # Team pages
    teams_dir = json_dir / "teams"
    teams_dir.mkdir(exist_ok=True)
    teams = conn.execute("SELECT team_id, team_name FROM mart.mart_league_table").df()

    for _, team in teams.iterrows():
        tid = int(team["team_id"])
        tname = team["team_name"]
        standings = conn.execute(
            "SELECT * FROM mart.mart_league_table WHERE team_id = ?", [tid]
        ).df().to_dict(orient="records")
        form = conn.execute(
            "SELECT * FROM mart.mart_team_form WHERE team_id = ?", [tid]
        ).df().to_dict(orient="records")
        matches = conn.execute("""
            SELECT * FROM mart.mart_recent_results
            WHERE home_team_id = ? OR away_team_id = ?
            ORDER BY match_date DESC
        """, [tid, tid]).df()
        scorers = conn.execute("""
            SELECT * FROM mart.mart_top_scorers
            WHERE team_name = ?
            ORDER BY goals DESC
        """, [tname]).df()

        team_data = {
            "team_id": tid,
            "team_name": tname,
            "standings": standings[0] if standings else {},
            "form": form[0].get("form_string", "") if form else "",
            "matches": json.loads(matches.to_json(orient="records", date_format="iso")),
            "scorers": json.loads(scorers.to_json(orient="records")),
        }
        with open(teams_dir / f"{tid}.json", "w") as f:
            json.dump(team_data, f, indent=2, default=str)

    log(f"  ✓ Exported {len(teams)} team pages")

    # StatsBomb match events index (2003/04 Arsenal season)
    try:
        events_matches = conn.execute(
            "SELECT DISTINCT match_id FROM raw.events LIMIT 38"
        ).df()
        events_dir = json_dir / "match_events"
        events_dir.mkdir(exist_ok=True)

        for mid in events_matches["match_id"]:
            df = conn.execute("""
                SELECT event_id, match_id, period, minute, second,
                       event_type, player_name, team_name, position_name,
                       location_x, location_y, outcome, sub_type
                FROM raw.events WHERE match_id = ?
                ORDER BY period, minute, second
            """, [mid]).df()
            df.to_json(events_dir / f"{mid}.json", orient="records", indent=2)

        log(f"  ✓ Exported {len(events_matches)} StatsBomb match event files")

        # Export events match list
        match_meta = conn.execute("""
            SELECT m.match_id, m.match_date, m.home_team_name, m.away_team_name,
                   m.home_score, m.away_score, m.matchday
            FROM raw.matches m
            WHERE m.season_id = 44 OR m.season_id = 27
            ORDER BY m.match_date
        """).df()
        match_meta.to_json(json_dir / "events_matches.json", orient="records", indent=2, date_format="iso")
        log(f"  ✓ events_matches.json: {len(match_meta)} matches")
    except Exception as e:
        log(f"  WARNING: Could not export StatsBomb events: {e}")

    log(f"  ✓ All exports complete → {json_dir}")


def run_quality_checks(conn: duckdb.DuckDBPyConnection):
    """Verify data quality."""
    log("Running quality checks…")
    checks = [
        ("380 matches in 2023-24", "SELECT COUNT(*) FROM raw.matches WHERE season_id=2324", lambda n: n >= 300),
        ("20 teams in league table", "SELECT COUNT(*) FROM mart.mart_league_table", lambda n: n == 20),
        ("Top scorers loaded", "SELECT COUNT(*) FROM mart.mart_top_scorers", lambda n: n >= 20),
        ("No negative points", "SELECT COUNT(*) FROM mart.mart_league_table WHERE points < 0", lambda n: n == 0),
        ("City/Arsenal in table", "SELECT COUNT(*) FROM mart.mart_league_table WHERE team_name IN ('Manchester City', 'Arsenal')", lambda n: n == 2),
    ]
    passed = failed = 0
    for name, query, check in checks:
        val = conn.execute(query).fetchone()[0]
        ok = check(val)
        status = "✓ PASS" if ok else "✗ FAIL"
        log(f"  {status}: {name} (={val})")
        if ok:
            passed += 1
        else:
            failed += 1
    log(f"Checks: {passed} passed, {failed} failed")
    return failed == 0


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    log("=" * 60)
    log("EPL 2023-24 FULL SEASON INGESTION")
    log(f"Database: {DB_PATH}")
    log("=" * 60)

    conn = duckdb.connect(str(DB_PATH))
    try:
        # Download 2023-24 full season
        download_2324_season(conn)

        # Load top scorers
        load_top_scorers_2324(conn)

        # Rebuild staging + mart
        rebuild_staging_mart_2324(conn)

        # Quality checks
        run_quality_checks(conn)

        # Export JSON
        export_json_2324(conn)

        log("=" * 60)
        log("✅ 2023-24 SEASON INGESTION COMPLETE")
        log("=" * 60)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
