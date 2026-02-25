"""
Data Quality Check Lambda
Validates the latest S3 objects for the EPL pipeline:
- Non-empty files
- Valid JSON structure
- Expected keys present
- Basic row count validation
"""

import json
import os
import logging
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_LAKE_BUCKET"]

# Expected S3 prefixes and their required keys
CHECKS = {
    "staging/standings/": {
        "description": "Standings data",
        "required_keys": ["position", "team_name", "points", "played"],
        "min_rows": 1,
    },
    "staging/top_scorers/": {
        "description": "Top scorers data",
        "required_keys": ["player_name", "goals"],
        "min_rows": 1,
    },
    "raw/matches/": {
        "description": "Raw matches data",
        "required_keys": ["match_id", "home_team_name", "away_team_name"],
        "min_rows": 1,
    },
    "raw/live_matches/": {
        "description": "Live matches data",
        "required_keys": ["match_id", "status"],
        "min_rows": 0,  # may be empty outside match windows
    },
}


def get_latest_object(prefix: str) -> dict | None:
    """Get the most recently modified object under a prefix."""
    response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix, MaxKeys=50)
    contents = response.get("Contents", [])
    # Filter out folder markers
    objects = [o for o in contents if o["Size"] > 0]
    if not objects:
        return None
    return max(objects, key=lambda o: o["LastModified"])


def validate_json_object(key: str) -> tuple[bool, list | dict, str]:
    """Read and parse a JSON object from S3. Returns (success, data, error)."""
    try:
        resp = s3.get_object(Bucket=BUCKET, Key=key)
        body = resp["Body"].read().decode("utf-8")
        data = json.loads(body)
        return True, data, ""
    except json.JSONDecodeError as e:
        return False, [], f"Invalid JSON: {e}"
    except Exception as e:
        return False, [], f"Read error: {e}"


def check_keys(record: dict, required_keys: list[str]) -> list[str]:
    """Check that required keys exist in a record."""
    return [k for k in required_keys if k not in record]


def handler(event, context):
    """Run data quality checks and return pass/fail with details."""
    logger.info("Starting data quality checks")

    results = []
    overall_pass = True
    timestamp = datetime.now(timezone.utc).isoformat()

    for prefix, config in CHECKS.items():
        check_result = {
            "prefix": prefix,
            "description": config["description"],
            "status": "PASS",
            "details": {},
        }

        # 1. Check latest object exists
        latest = get_latest_object(prefix)
        if latest is None:
            if config["min_rows"] > 0:
                check_result["status"] = "FAIL"
                check_result["details"]["error"] = "No objects found"
                overall_pass = False
            else:
                check_result["status"] = "SKIP"
                check_result["details"]["note"] = "No objects found (acceptable)"
            results.append(check_result)
            continue

        key = latest["Key"]
        check_result["details"]["latest_key"] = key
        check_result["details"]["last_modified"] = latest["LastModified"].isoformat()
        check_result["details"]["size_bytes"] = latest["Size"]

        # 2. Check if file is parseable (try JSON, fall back to noting it's parquet)
        if key.endswith(".json"):
            valid, data, error = validate_json_object(key)
            if not valid:
                check_result["status"] = "FAIL"
                check_result["details"]["error"] = error
                overall_pass = False
                results.append(check_result)
                continue

            # 3. Row count check
            rows = data if isinstance(data, list) else [data]
            check_result["details"]["row_count"] = len(rows)
            if len(rows) < config["min_rows"]:
                check_result["status"] = "FAIL"
                check_result["details"]["error"] = (
                    f"Row count {len(rows)} < minimum {config['min_rows']}"
                )
                overall_pass = False
                results.append(check_result)
                continue

            # 4. Schema check on first record
            if rows:
                missing = check_keys(rows[0], config["required_keys"])
                if missing:
                    check_result["status"] = "FAIL"
                    check_result["details"]["missing_keys"] = missing
                    overall_pass = False
        else:
            # Parquet or other binary — just verify non-empty
            check_result["details"]["format"] = "binary/parquet"
            if latest["Size"] < 100:
                check_result["status"] = "WARN"
                check_result["details"]["warning"] = "File suspiciously small"

        results.append(check_result)

    summary = {
        "timestamp": timestamp,
        "overall_status": "PASS" if overall_pass else "FAIL",
        "checks_run": len(results),
        "checks_passed": sum(1 for r in results if r["status"] == "PASS"),
        "checks_failed": sum(1 for r in results if r["status"] == "FAIL"),
        "results": results,
    }

    logger.info(f"Quality check complete: {summary['overall_status']}")
    return summary
