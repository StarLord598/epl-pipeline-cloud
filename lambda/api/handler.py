"""
EPL Pipeline API Lambda
Serves pipeline data from S3 via API Gateway.
Routes: /standings, /scorers, /matches, /health

Note: CORS Allow-Origin is set to '*' for this portfolio demo.
In production, restrict to specific domains.
"""

import json
import os
import logging
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
sfn = boto3.client("stepfunctions")

BUCKET = os.environ["DATA_LAKE_BUCKET"]
STEP_FUNCTION_ARN = os.environ.get("STEP_FUNCTION_ARN", "")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# S3 prefix mapping for each endpoint
ENDPOINT_MAP = {
    "/standings": "raw/standings/",
    "/scorers": "raw/top_scorers/",
    "/matches": "raw/matches/",
}


def respond(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def get_latest_object(prefix: str) -> dict | None:
    """Get the most recently modified object under a prefix."""
    response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix, MaxKeys=50)
    contents = response.get("Contents", [])
    objects = [o for o in contents if o["Size"] > 0]
    if not objects:
        return None
    return max(objects, key=lambda o: o["LastModified"])


def read_s3_json(key: str) -> tuple[bool, any, str]:
    """Read a JSON file from S3."""
    try:
        resp = s3.get_object(Bucket=BUCKET, Key=key)
        body = resp["Body"].read().decode("utf-8")
        return True, json.loads(body), ""
    except Exception as e:
        return False, None, str(e)


def handle_data_endpoint(prefix: str, is_matches: bool = False) -> dict:
    """Handle a data endpoint by reading the latest S3 object."""
    latest = get_latest_object(prefix)
    if not latest:
        return respond(404, {"error": "No data available", "prefix": prefix})

    key = latest["Key"]
    if not key.endswith(".json"):
        return respond(200, {
            "message": "Data available in Parquet format. Use Athena for queries.",
            "metadata": {
                "source": key,
                "last_modified": latest["LastModified"].isoformat(),
                "size_bytes": latest["Size"],
                "format": "parquet",
            },
        })

    ok, data, err = read_s3_json(key)
    if not ok:
        return respond(500, {"error": f"Failed to read data: {err}"})

    sources = [key]

    # For /matches, overlay live match data on top of daily data
    if is_matches:
        live_latest = get_latest_object("raw/live_matches/")
        if live_latest and live_latest["Key"].endswith(".json"):
            live_ok, live_data, _ = read_s3_json(live_latest["Key"])
            if live_ok:
                live_matches = live_data.get("matches", [])
                if live_matches:
                    # Build lookup of live matches by ID
                    live_by_id = {m["id"]: m for m in live_matches}
                    # Overlay: replace daily matches with live versions
                    base_matches = data.get("matches", [])
                    merged = []
                    for m in base_matches:
                        if m["id"] in live_by_id:
                            merged.append(live_by_id[m["id"]])
                        else:
                            merged.append(m)
                    data["matches"] = merged
                    sources.append(live_latest["Key"])
                    logger.info(f"Merged {len(live_by_id)} live matches from {live_latest['Key']}")

    return respond(200, {
        "data": data,
        "metadata": {
            "source": sources[0] if len(sources) == 1 else sources,
            "last_modified": latest["LastModified"].isoformat(),
            "size_bytes": latest["Size"],
        },
    })


def handle_health() -> dict:
    """Return pipeline health status."""
    health = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "bucket": BUCKET,
        "checks": {},
    }

    for name, prefix in ENDPOINT_MAP.items():
        latest = get_latest_object(prefix)
        if latest:
            health["checks"][name.strip("/")] = {
                "status": "ok",
                "last_modified": latest["LastModified"].isoformat(),
                "size_bytes": latest["Size"],
            }
        else:
            health["checks"][name.strip("/")] = {"status": "no_data"}
            health["status"] = "degraded"

    # Check Step Function status if configured
    if STEP_FUNCTION_ARN:
        try:
            resp = sfn.list_executions(
                stateMachineArn=STEP_FUNCTION_ARN,
                maxResults=1,
                statusFilter="SUCCEEDED",
            )
            execs = resp.get("executions", [])
            if execs:
                health["checks"]["step_function"] = {
                    "status": "ok",
                    "last_success": execs[0]["stopDate"].isoformat(),
                }
            else:
                health["checks"]["step_function"] = {"status": "no_executions"}
        except Exception as e:
            health["checks"]["step_function"] = {"status": "error", "error": str(e)}

    return respond(200, health)


def handler(event, context):
    """Main Lambda handler for API Gateway."""
    logger.info(f"Request: {json.dumps(event)}")

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")

    # Handle CORS preflight
    if method == "OPTIONS":
        return respond(200, {})

    if path == "/health":
        return handle_health()

    if path in ENDPOINT_MAP:
        return handle_data_endpoint(ENDPOINT_MAP[path], is_matches=(path == "/matches"))

    return respond(404, {"error": "Not found", "path": path})
