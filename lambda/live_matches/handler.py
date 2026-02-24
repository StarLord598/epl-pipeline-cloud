"""AWS Lambda handler — Live EPL match ingestion.

Fetches live/recent match data from football-data.org (or TheSportsDB fallback)
and writes Parquet files to S3 data lake, partitioned by ingestion date.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
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


def fetch_football_data_org(api_key: str) -> list[dict[str, Any]]:
    headers = {"X-Auth-Token": api_key}
    today = datetime.now(timezone.utc).date()
    date_from = (today - timedelta(days=1)).isoformat()
    date_to = (today + timedelta(days=2)).isoformat()

    url = "https://api.football-data.org/v4/competitions/PL/matches"
    params = {"dateFrom": date_from, "dateTo": date_to}
    r = requests.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    payload = r.json()

    rows = []
    for m in payload.get("matches", []):
        rows.append({
            "source": "football-data.org",
            "match_id": str(m.get("id")),
            "competition": payload.get("competition", {}).get("name", "Premier League"),
            "season": str(payload.get("filters", {}).get("season") or "current"),
            "utc_date": m.get("utcDate"),
            "status": m.get("status"),
            "minute": None,
            "home_team_name": m.get("homeTeam", {}).get("name"),
            "away_team_name": m.get("awayTeam", {}).get("name"),
            "home_score": m.get("score", {}).get("fullTime", {}).get("home"),
            "away_score": m.get("score", {}).get("fullTime", {}).get("away"),
            "winner": m.get("score", {}).get("winner"),
        })
    return rows


def fetch_thesportsdb_fallback() -> list[dict[str, Any]]:
    url = "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    payload = r.json()

    rows = []
    for m in payload.get("events", []) or []:
        dt = None
        if m.get("dateEvent") and m.get("strTime"):
            dt = f"{m['dateEvent']}T{m['strTime']}"
        rows.append({
            "source": "thesportsdb",
            "match_id": str(m.get("idEvent")),
            "competition": m.get("strLeague") or "Premier League",
            "season": m.get("strSeason") or "current",
            "utc_date": dt,
            "status": m.get("strStatus") or "SCHEDULED",
            "minute": None,
            "home_team_name": m.get("strHomeTeam"),
            "away_team_name": m.get("strAwayTeam"),
            "home_score": int(m["intHomeScore"]) if m.get("intHomeScore") else None,
            "away_score": int(m["intAwayScore"]) if m.get("intAwayScore") else None,
            "winner": None,
        })
    return rows


def handler(event, context):
    """Lambda entry point."""
    logger.info("Live matches ingest triggered: %s", json.dumps(event))

    try:
        secrets = get_secret()
        api_key = secrets.get("FOOTBALL_DATA_API_KEY", "").strip()

        rows = []
        source_used = ""
        try:
            if api_key:
                rows = fetch_football_data_org(api_key)
                source_used = "football-data.org"
            else:
                rows = fetch_thesportsdb_fallback()
                source_used = "thesportsdb"
        except Exception:
            logger.warning("Primary source failed, using fallback", exc_info=True)
            rows = fetch_thesportsdb_fallback()
            source_used = "thesportsdb-fallback"

        if not rows:
            return {"statusCode": 200, "body": json.dumps({"status": "no_matches", "source": source_used})}

        now = datetime.now(timezone.utc)
        df = pd.DataFrame(rows)
        df["ingested_at"] = now.isoformat()

        # Partition by date
        ingestion_date = now.strftime("%Y-%m-%d")
        ts = now.strftime("%H%M%S")
        key = f"raw/live_matches/ingestion_date={ingestion_date}/{ts}.parquet"
        count = write_parquet_to_s3(df, key)

        result = {
            "status": "success",
            "source": source_used,
            "matches_ingested": count,
            "timestamp": now.isoformat(),
        }
        logger.info("Complete: %s", json.dumps(result))
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as ex:
        logger.error("Live ingest failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
