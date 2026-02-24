"""AWS Lambda — Live EPL match ingestion.

Polls football-data.org for today's matches, writes JSON snapshots to S3.
Runs every 15 minutes on matchdays via EventBridge.
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
COMPETITION = "PL"


def get_api_key() -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=os.environ["SECRET_ARN"])
    return json.loads(resp["SecretString"])["FOOTBALL_DATA_API_KEY"]


def handler(event, context):
    logger.info("Live matches triggered: %s", json.dumps(event))
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y%m%d_%H%M%S")
    date_str = now.strftime("%Y-%m-%d")

    try:
        api_key = get_api_key()

        # Fetch today's matches
        url = f"https://api.football-data.org/v4/competitions/{COMPETITION}/matches"
        resp = requests.get(
            url,
            headers={"X-Auth-Token": api_key},
            params={"dateFrom": date_str, "dateTo": date_str},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        matches = data.get("matches", [])
        if not matches:
            logger.info("No matches today (%s)", date_str)
            return {"statusCode": 200, "body": json.dumps({"matches": 0, "date": date_str})}

        # Write snapshot
        key = f"raw/live_matches/{date_str}/{ts}.json"
        body = json.dumps(data, default=str, indent=2)
        s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")
        logger.info("Wrote %d matches to s3://%s/%s", len(matches), BUCKET, key)

        return {
            "statusCode": 200,
            "body": json.dumps({"matches": len(matches), "date": date_str, "key": key}),
        }

    except Exception as ex:
        logger.error("Live ingest failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
