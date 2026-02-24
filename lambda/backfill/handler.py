"""AWS Lambda handler — Backfill EPL season data.

Fetches all matches for the current season from football-data.org and writes
Parquet to S3 data lake. Safe to run multiple times — deduplication happens
at the Athena/dbt layer via match_id.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3
import pandas as pd
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_LAKE_BUCKET"]
SECRET_ARN = os.environ["SECRET_ARN"]


def get_secret() -> dict:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=SECRET_ARN)
    return json.loads(resp["SecretString"])


def write_parquet_to_s3(df: pd.DataFrame, key: str) -> int:
    if df.empty:
        return 0
    buf = df.to_parquet(index=False)
    s3.put_object(Bucket=BUCKET, Key=key, Body=buf, ContentType="application/octet-stream")
    logger.info("Wrote %d rows to s3://%s/%s", len(df), BUCKET, key)
    return len(df)


def fetch_all_matches(api_key: str) -> list[dict[str, Any]]:
    """Fetch all matches for current EPL season from football-data.org."""
    headers = {"X-Auth-Token": api_key}
    url = "https://api.football-data.org/v4/competitions/PL/matches"

    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    payload = r.json()

    competition = payload.get("competition", {}).get("name", "Premier League")
    season_start = payload.get("filters", {}).get("season", "2025")

    rows = []
    for m in payload.get("matches", []):
        rows.append({
            "source": "football-data.org",
            "match_id": str(m.get("id")),
            "competition": competition,
            "season": str(season_start),
            "utc_date": m.get("utcDate"),
            "status": m.get("status"),
            "minute": None,
            "home_team_name": m.get("homeTeam", {}).get("name"),
            "away_team_name": m.get("awayTeam", {}).get("name"),
            "home_score": m.get("score", {}).get("fullTime", {}).get("home"),
            "away_score": m.get("score", {}).get("fullTime", {}).get("away"),
            "winner": m.get("score", {}).get("winner"),
            "matchday": m.get("matchday"),
        })
    return rows


def handler(event, context):
    """Lambda entry point."""
    logger.info("Backfill triggered: %s", json.dumps(event))

    try:
        secrets = get_secret()
        api_key = secrets.get("FOOTBALL_DATA_API_KEY", "").strip()

        if not api_key:
            return {"statusCode": 400, "body": json.dumps({"error": "FOOTBALL_DATA_API_KEY not configured"})}

        rows = fetch_all_matches(api_key)

        if not rows:
            return {"statusCode": 200, "body": json.dumps({"status": "no_matches"})}

        now = datetime.now(timezone.utc)
        df = pd.DataFrame(rows)
        df["ingested_at"] = now.isoformat()

        ts = now.strftime("%Y%m%d_%H%M%S")
        key = f"raw/live_matches/backfill/{ts}.parquet"
        count = write_parquet_to_s3(df, key)

        finished = len([r for r in rows if r["status"] == "FINISHED"])
        scheduled = len([r for r in rows if r["status"] in ("TIMED", "SCHEDULED")])

        result = {
            "status": "success",
            "total_matches": len(rows),
            "finished": finished,
            "scheduled": scheduled,
            "rows_written": count,
            "timestamp": now.isoformat(),
        }
        logger.info("Backfill complete: %s", json.dumps(result))
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as ex:
        logger.error("Backfill failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
