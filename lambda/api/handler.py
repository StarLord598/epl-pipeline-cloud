"""
EPL Pipeline API Lambda
Serves pipeline data from S3 via API Gateway.
Routes: /standings, /scorers, /matches, /health
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
    "/standings": "staging/standings/",
    "/scorers": "staging/top_scorers/",
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


def handle_data_endpoint(prefix: str) -> dict:
    """Handle a data endpoint by reading the latest S3 object."""
    latest = get_latest_object(prefix)
    if not latest:
        return respond(404, {"error": "No data available", "prefix": prefix})

    key = latest["Key"]
    if key.endswith(".json"):
        ok, data, err = read_s3_json(key)
        if not ok:
            return respond(500, {"error": f"Failed to read data: {err}"})
        return respond(200, {
            "data": data,
            "metadata": {
                "source": key,
                "last_modified": latest["LastModified"].isoformat(),
                "size_bytes": latest["Size"],
            },
        })
    else:
        # For parquet files, return metadata only
        return respond(200, {
            "message": "Data available in Parquet format. Use Athena for queries.",
            "metadata": {
                "source": key,
                "last_modified": latest["LastModified"].isoformat(),
                "size_bytes": latest["Size"],
                "format": "parquet",
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
        return handle_data_endpoint(ENDPOINT_MAP[path])

    return respond(404, {"error": "Not found", "path": path})
