"""AWS Lambda handler — Daily EPL data ingestion.

Wraps the existing StatsBomb ingestion logic, writing Parquet to S3 data lake
instead of DuckDB. Medallion architecture: raw/ layer in S3.
"""

import json
import logging
import os
from datetime import datetime, timezone

import boto3
import pandas as pd
from statsbombpy import sb

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_LAKE_BUCKET"]
GLUE_DB = os.environ["GLUE_DATABASE"]
COMPETITION_ID = 2  # EPL


def get_secret(secret_arn: str) -> dict:
    """Retrieve secrets from AWS Secrets Manager."""
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=secret_arn)
    return json.loads(resp["SecretString"])


def write_parquet_to_s3(df: pd.DataFrame, key: str) -> int:
    """Write a DataFrame as Parquet to S3. Returns row count."""
    if df.empty:
        logger.warning("Empty DataFrame, skipping write to %s", key)
        return 0
    buf = df.to_parquet(index=False)
    s3.put_object(Bucket=BUCKET, Key=key, Body=buf, ContentType="application/octet-stream")
    logger.info("Wrote %d rows to s3://%s/%s", len(df), BUCKET, key)
    return len(df)


def ingest_matches(competition_id: int, season_id: int) -> list[int]:
    """Fetch matches from StatsBomb and write to S3 raw layer."""
    logger.info("Fetching matches for comp=%d season=%d", competition_id, season_id)
    matches_df = sb.matches(competition_id=competition_id, season_id=season_id)

    if matches_df.empty:
        logger.warning("No matches returned from StatsBomb")
        return []

    # Normalize columns
    rows = []
    for _, m in matches_df.iterrows():
        rows.append({
            "match_id": int(m.get("match_id", 0)),
            "competition_id": int(m.get("competition_id", 0)),
            "competition_name": str(m.get("competition", "")),
            "season_id": int(m.get("season_id", 0)),
            "season_name": str(m.get("season", "")),
            "match_date": str(m.get("match_date", "")),
            "home_team_id": int(m.get("home_team_id", 0)) if pd.notna(m.get("home_team_id")) else 0,
            "home_team_name": str(m.get("home_team", "")),
            "away_team_id": int(m.get("away_team_id", 0)) if pd.notna(m.get("away_team_id")) else 0,
            "away_team_name": str(m.get("away_team", "")),
            "home_score": int(m.get("home_score", 0)) if pd.notna(m.get("home_score")) else None,
            "away_score": int(m.get("away_score", 0)) if pd.notna(m.get("away_score")) else None,
            "match_status": str(m.get("match_status", "available")),
            "matchday": int(m.get("match_week", 0)) if pd.notna(m.get("match_week")) else 0,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        })

    df = pd.DataFrame(rows)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    key = f"raw/matches/season_{season_id}/{ts}.parquet"
    write_parquet_to_s3(df, key)

    return [r["match_id"] for r in rows]


def ingest_events(match_ids: list[int], max_matches: int = 50) -> int:
    """Fetch events for matches and write to S3 raw layer."""
    sample = match_ids[:max_matches]
    all_events = []

    for i, match_id in enumerate(sample):
        try:
            events_df = sb.events(match_id=match_id)
            if events_df.empty:
                continue

            for _, e in events_df.iterrows():
                location = e.get("location", None)
                loc_x, loc_y = None, None
                if isinstance(location, list) and len(location) >= 2:
                    loc_x, loc_y = float(location[0]), float(location[1])

                all_events.append({
                    "event_id": str(e.get("id", "")),
                    "match_id": match_id,
                    "period": int(e.get("period", 0)),
                    "minute": int(e.get("minute", 0)),
                    "second": int(e.get("second", 0)),
                    "event_type": str(e.get("type", "")),
                    "team_name": str(e.get("team", "")),
                    "player_name": str(e.get("player", "")) if pd.notna(e.get("player")) else None,
                    "location_x": loc_x,
                    "location_y": loc_y,
                    "sub_type": str(e.get("pass_type", e.get("shot_type", ""))) if pd.notna(e.get("pass_type", e.get("shot_type", None))) else None,
                    "outcome": str(e.get("shot_outcome", e.get("pass_outcome", ""))) if pd.notna(e.get("shot_outcome", e.get("pass_outcome", None))) else None,
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                })

            if (i + 1) % 10 == 0:
                logger.info("Processed %d/%d matches", i + 1, len(sample))
        except Exception as ex:
            logger.warning("Failed to load events for match %d: %s", match_id, ex)

    if all_events:
        df = pd.DataFrame(all_events).drop_duplicates(subset=["event_id"])
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        key = f"raw/events/{ts}.parquet"
        write_parquet_to_s3(df, key)

    return len(all_events)


def ingest_lineups(match_ids: list[int], max_matches: int = 100) -> int:
    """Fetch lineups and write to S3 raw layer."""
    sample = match_ids[:max_matches]
    all_rows = []

    for match_id in sample:
        try:
            lineups = sb.lineups(match_id=match_id)
            for team_name, lineup_df in lineups.items():
                for _, p in lineup_df.iterrows():
                    positions = p.get("positions", [])
                    pos_name = None
                    if positions and isinstance(positions, list):
                        pos_name = positions[0].get("position")

                    all_rows.append({
                        "match_id": match_id,
                        "team_name": team_name,
                        "player_id": int(p.get("player_id", 0)),
                        "player_name": str(p.get("player_name", "")),
                        "jersey_number": int(p.get("jersey_number", 0)) if pd.notna(p.get("jersey_number")) else 0,
                        "position_name": pos_name,
                        "ingested_at": datetime.now(timezone.utc).isoformat(),
                    })
        except Exception as ex:
            logger.warning("Failed to load lineup for match %d: %s", match_id, ex)

    if all_rows:
        df = pd.DataFrame(all_rows)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        key = f"raw/lineups/{ts}.parquet"
        write_parquet_to_s3(df, key)

    return len(all_rows)


def handler(event, context):
    """Lambda entry point."""
    logger.info("Daily ingest triggered: %s", json.dumps(event))

    try:
        # Find latest EPL season
        comps = sb.competitions()
        epl = comps[comps["competition_id"] == COMPETITION_ID]
        seasons = epl.sort_values("season_id", ascending=False)

        season_id = int(seasons.iloc[0]["season_id"])
        season_name = str(seasons.iloc[0]["season_name"])
        logger.info("Target season: %s (id=%d)", season_name, season_id)

        # Ingest
        match_ids = ingest_matches(COMPETITION_ID, season_id)
        event_count = ingest_events(match_ids, max_matches=50)
        lineup_count = ingest_lineups(match_ids, max_matches=100)

        result = {
            "status": "success",
            "season": season_name,
            "matches": len(match_ids),
            "events": event_count,
            "lineups": lineup_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.info("Ingestion complete: %s", json.dumps(result))
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as ex:
        logger.error("Ingestion failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
