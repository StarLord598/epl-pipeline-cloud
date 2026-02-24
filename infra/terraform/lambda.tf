# ─── Lambda Functions ─────────────────────────────────────────────────────────

# Placeholder zip for initial deployment (replaced by CI/CD)
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"

  source {
    content  = "def handler(event, context): return {'statusCode': 200}"
    filename = "handler.py"
  }
}

# ── Daily Ingest Lambda ───────────────────────────────────────────────────────

resource "aws_lambda_function" "daily_ingest" {
  function_name = "${var.project_name}-daily-ingest-${var.environment}"
  description   = "Daily EPL data ingestion from StatsBomb → S3 Parquet"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.11"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      DATA_LAKE_BUCKET = aws_s3_bucket.data_lake.id
      GLUE_DATABASE    = aws_glue_catalog_database.epl.name
      SECRET_ARN       = aws_secretsmanager_secret.api_keys.arn
      ENVIRONMENT      = var.environment
    }
  }

  layers = [aws_lambda_layer_version.dependencies.arn]
}

# ── Live Matches Lambda ───────────────────────────────────────────────────────

resource "aws_lambda_function" "live_matches" {
  function_name = "${var.project_name}-live-matches-${var.environment}"
  description   = "Live EPL match ingestion from football-data.org → S3 Parquet"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.11"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      DATA_LAKE_BUCKET = aws_s3_bucket.data_lake.id
      GLUE_DATABASE    = aws_glue_catalog_database.epl.name
      SECRET_ARN       = aws_secretsmanager_secret.api_keys.arn
      ENVIRONMENT      = var.environment
    }
  }

  layers = [aws_lambda_layer_version.dependencies.arn]
}

# ── Backfill Lambda ───────────────────────────────────────────────────────────

resource "aws_lambda_function" "backfill" {
  function_name = "${var.project_name}-backfill-${var.environment}"
  description   = "Backfill EPL season data from football-data.org → S3 Parquet"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.11"
  timeout       = 900 # max Lambda timeout for large backfills
  memory_size   = 1024

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      DATA_LAKE_BUCKET = aws_s3_bucket.data_lake.id
      GLUE_DATABASE    = aws_glue_catalog_database.epl.name
      SECRET_ARN       = aws_secretsmanager_secret.api_keys.arn
      ENVIRONMENT      = var.environment
    }
  }

  layers = [aws_lambda_layer_version.dependencies.arn]
}

# ── Shared Dependencies Layer ─────────────────────────────────────────────────

resource "aws_lambda_layer_version" "dependencies" {
  layer_name          = "${var.project_name}-deps-${var.environment}"
  description         = "Shared Python dependencies: pandas, pyarrow, requests, boto3"
  compatible_runtimes = ["python3.11"]

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256
}

# ── CloudWatch Log Groups ────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "daily_ingest" {
  name              = "/aws/lambda/${aws_lambda_function.daily_ingest.function_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "live_matches" {
  name              = "/aws/lambda/${aws_lambda_function.live_matches.function_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "backfill" {
  name              = "/aws/lambda/${aws_lambda_function.backfill.function_name}"
  retention_in_days = 30
}
