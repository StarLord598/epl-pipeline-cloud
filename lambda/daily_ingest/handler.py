"""AWS Lambda — Daily EPL data ingestion.

Fetches matches and standings from football-data.org API, writes JSON to S3.
Lightweight: no pandas/pyarrow, just stdlib + requests + boto3.
"""

import json
import logging
import os
from datetime import datetime, timezone

import boto3
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_LAKE_BUCKET"]
COMPETITION = "PL"  # Premier League
SEASON = "2025"     # 2025/26 season


def get_api_key() -> str:
    """Retrieve football-data.org API key from Secrets Manager."""
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=os.environ["SECRET_ARN"])
    secrets = json.loads(resp["SecretString"])
    return secrets["FOOTBALL_DATA_API_KEY"]


def fetch_football_data(endpoint: str, api_key: str) -> dict:
    """Call football-data.org API."""
    url = f"https://api.football-data.org/v4/{endpoint}"
    headers = {"X-Auth-Token": api_key}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def write_json_to_s3(data: dict | list, key: str) -> None:
    """Write JSON to S3."""
    body = json.dumps(data, default=str, indent=2)
    s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")
    logger.info("Wrote %d bytes to s3://%s/%s", len(body), BUCKET, key)


def handler(event, context):
    """Lambda entry point — daily ingest."""
    logger.info("Daily ingest triggered: %s", json.dumps(event))
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    try:
        api_key = get_api_key()

        # 1. Fetch all matches for the season
        matches = fetch_football_data(
            f"competitions/{COMPETITION}/matches?season={SEASON}", api_key
        )
        match_count = len(matches.get("matches", []))
        write_json_to_s3(matches, f"raw/matches/season_{SEASON}/{ts}_matches.json")
        logger.info("Ingested %d matches", match_count)

        # 2. Fetch current standings
        standings = fetch_football_data(
            f"competitions/{COMPETITION}/standings?season={SEASON}", api_key
        )
        write_json_to_s3(standings, f"raw/standings/season_{SEASON}/{ts}_standings.json")
        logger.info("Ingested standings")

        # 3. Fetch top scorers
        scorers = fetch_football_data(
            f"competitions/{COMPETITION}/scorers?season={SEASON}&limit=30", api_key
        )
        scorer_count = len(scorers.get("scorers", []))
        write_json_to_s3(scorers, f"raw/top_scorers/season_{SEASON}/{ts}_scorers.json")
        logger.info("Ingested %d scorers", scorer_count)

        result = {
            "status": "success",
            "season": f"{SEASON}/{int(SEASON)+1}",
            "matches": match_count,
            "scorers": scorer_count,
            "timestamp": ts,
        }
        logger.info("Daily ingest complete: %s", json.dumps(result))
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as ex:
        logger.error("Ingestion failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
