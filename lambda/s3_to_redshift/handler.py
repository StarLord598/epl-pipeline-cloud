"""AWS Lambda — S3 to Redshift Serverless loader.

Loads raw JSON data from S3 into Redshift Serverless using the
redshift-data API (no psycopg2 or drivers needed). Creates schemas
and tables if they don't exist, then runs COPY from latest S3 objects.
"""

import json
import logging
import os
import time

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
redshift_data = boto3.client("redshift-data")

BUCKET = os.environ["DATA_LAKE_BUCKET"]
WORKGROUP = os.environ["REDSHIFT_WORKGROUP"]
DATABASE = os.environ["REDSHIFT_DATABASE"]
IAM_ROLE = os.environ["REDSHIFT_IAM_ROLE"]
SEASON = "2025"

# ─── Table DDL ────────────────────────────────────────────────────────────────

SCHEMAS_SQL = """
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS staging;
"""

TABLES_SQL = {
    "raw.matches": """
        CREATE TABLE IF NOT EXISTS raw.matches (
            match_id          INTEGER,
            competition_id    INTEGER,
            competition_name  VARCHAR(256),
            season_id         INTEGER,
            season_name       VARCHAR(64),
            match_date        DATE,
            kick_off          VARCHAR(32),
            home_team_id      INTEGER,
            home_team_name    VARCHAR(256),
            away_team_id      INTEGER,
            away_team_name    VARCHAR(256),
            home_score        INTEGER,
            away_score        INTEGER,
            match_status      VARCHAR(64),
            matchday          INTEGER,
            ingested_at       TIMESTAMP DEFAULT GETDATE()
        );
    """,
    "raw.standings": """
        CREATE TABLE IF NOT EXISTS raw.standings (
            team_id           INTEGER,
            team_name         VARCHAR(256),
            position          INTEGER,
            played            INTEGER,
            won               INTEGER,
            drawn             INTEGER,
            lost              INTEGER,
            points            INTEGER,
            goals_for         INTEGER,
            goals_against     INTEGER,
            goal_difference   INTEGER,
            ingested_at       TIMESTAMP DEFAULT GETDATE()
        );
    """,
    "raw.top_scorers": """
        CREATE TABLE IF NOT EXISTS raw.top_scorers (
            player_id         INTEGER,
            player_name       VARCHAR(256),
            team_id           INTEGER,
            team_name         VARCHAR(256),
            goals             INTEGER,
            assists           INTEGER,
            penalties         INTEGER,
            played_matches    INTEGER,
            ingested_at       TIMESTAMP DEFAULT GETDATE()
        );
    """,
}


def wait_for_statement(statement_id: str, timeout: int = 120) -> dict:
    """Poll redshift-data until statement completes or times out."""
    start = time.time()
    while time.time() - start < timeout:
        resp = redshift_data.describe_statement(Id=statement_id)
        status = resp["Status"]
        if status in ("FINISHED",):
            return resp
        if status in ("FAILED", "ABORTED"):
            raise RuntimeError(
                f"Statement {statement_id} {status}: {resp.get('Error', 'unknown')}"
            )
        time.sleep(2)
    raise TimeoutError(f"Statement {statement_id} timed out after {timeout}s")


def execute_sql(sql: str) -> dict:
    """Execute a SQL statement against Redshift Serverless and wait."""
    logger.info("Executing SQL: %.200s...", sql.strip())
    resp = redshift_data.execute_statement(
        WorkgroupName=WORKGROUP,
        Database=DATABASE,
        Sql=sql,
    )
    return wait_for_statement(resp["Id"])


def get_latest_s3_key(prefix: str) -> str | None:
    """Find the most recent object under an S3 prefix."""
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
    objects = resp.get("Contents", [])
    if not objects:
        return None
    # Sort by LastModified descending, pick newest
    objects.sort(key=lambda o: o["LastModified"], reverse=True)
    return objects[0]["Key"]


def copy_json_to_table(table: str, s3_prefix: str) -> bool:
    """COPY the latest JSON file from S3 into a Redshift table."""
    key = get_latest_s3_key(s3_prefix)
    if not key:
        logger.warning("No objects found under s3://%s/%s — skipping %s", BUCKET, s3_prefix, table)
        return False

    s3_path = f"s3://{BUCKET}/{key}"
    copy_sql = f"""
        COPY {table}
        FROM '{s3_path}'
        IAM_ROLE '{IAM_ROLE}'
        JSON 'auto'
        TIMEFORMAT 'auto'
        TRUNCATECOLUMNS
        ACCEPTINVCHARS;
    """
    execute_sql(copy_sql)
    logger.info("COPY complete: %s ← %s", table, s3_path)
    return True


def handler(event, context):
    """Lambda entry point — load S3 data into Redshift."""
    logger.info("S3→Redshift loader triggered: %s", json.dumps(event))

    try:
        # 1. Create schemas
        for stmt in SCHEMAS_SQL.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                execute_sql(stmt + ";")
        logger.info("Schemas ensured: raw, staging")

        # 2. Create tables
        for table_name, ddl in TABLES_SQL.items():
            execute_sql(ddl)
        logger.info("Tables ensured: %s", ", ".join(TABLES_SQL.keys()))

        # 3. COPY data from S3
        results = {}
        copy_map = {
            "raw.matches": f"raw/matches/season_{SEASON}/",
            "raw.standings": f"raw/standings/season_{SEASON}/",
            "raw.top_scorers": f"raw/top_scorers/season_{SEASON}/",
        }

        for table, prefix in copy_map.items():
            loaded = copy_json_to_table(table, prefix)
            results[table] = "loaded" if loaded else "skipped (no data)"

        result = {"status": "success", "tables": results}
        logger.info("S3→Redshift load complete: %s", json.dumps(result))
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as ex:
        logger.error("S3→Redshift load failed: %s", str(ex), exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(ex)})}
