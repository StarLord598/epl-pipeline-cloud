"""AWS Lambda — Backfill EPL season data.

Fetches complete season data (all matchdays) from football-data.org.
Writes per-matchday JSON files to S3 for historical completeness.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import boto3
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_LAKE_BUCKET"]
COMPETITION = "PL"


def get_api_key() -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=os.environ["SECRET_ARN"])
    return json.loads(resp["SecretString"])["FOOTBALL_DATA_API_KEY"]


def handler(event, context):
    """Backfill handler. Pass {"season": "2025"} to specify season."""
    logger.info("Backfill triggered: %s", json.dumps(event))
    season = event.get("season", "2025")
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    try:
        api_key = get_api_key()
        headers = {"X-Auth-Token": api_key}
        base = "https://api.football-data.org/v4"

        # 1. All matches
        resp = requests.get(
            f"{base}/competitions/{COMPETITION}/matches?season={season}",
            headers=headers, timeout=30,
        )
        resp.raise_for_status()
        matches_data = resp.json()
        matches = matches_data.get("matches", [])

        key = f"raw/matches/season_{season}/{ts}_backfill_all.json"
        s3.put_object(Bucket=BUCKET, Key=key, Body=json.dumps(matches_data, default=str, indent=2), ContentType="application/json")
        logger.info("Wrote %d matches to %s", len(matches), key)

        # 2. Per-matchday breakdown
        matchdays = {}
        for m in matches:
            md = m.get("matchday", 0)
            matchdays.setdefault(md, []).append(m)

        for md, md_matches in sorted(matchdays.items()):
            md_key = f"raw/matches/season_{season}/matchday_{md:02d}/{ts}.json"
            s3.put_object(
                Bucket=BUCKET, Key=md_key,
                Body=json.dumps({"matchday": md, "matches": md_matches}, default=str, indent=2),
                ContentType="application/json",
            )

        # 3. Standings
        time.sleep(1)  # rate limit
        resp = requests.get(
            f"{base}/competitions/{COMPETITION}/standings?season={season}",
            headers=headers, timeout=30,
        )
        resp.raise_for_status()
        standings = resp.json()
        s3.put_object(
            Bucket=BUCKET,
            Key=f"raw/standings/season_{season}/{ts}_backfill.json",
            Body=json.dumps(standings, default=str, indent=2),
            ContentType="application/json",
        )

        # 4. Top scorers
        time.sleep(1)
        resp = requests.get(
            f"{base}/competitions/{COMPETITION}/scorers?season={season}&limit=50",
            headers=headers, timeout=30,
        )
        resp.raise_for_status()
        scorers = resp.json()
        s3.put_object(
            Bucket=BUCKET,
            Key=f"raw/top_scorers/season_{season}/{ts}_backfill.json",
            Body=json.dumps(scorers, default=str, indent=2),
            ContentType="application/json",
        )

        result = {
            "status": "success",
            "season": season,
            "matches": len(matches),
            "matchdays": len(matchdays),
            "timestamp": ts,
        }
        logger.info("Backfill complete: %s", json.dumps(result))
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as ex:
        logger.error("Backfill failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
