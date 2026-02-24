# ─── S3 Data Lake ─────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "data_lake" {
  bucket = "${var.project_name}-data-lake-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "data_lake" {
  bucket                  = aws_s3_bucket.data_lake.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"
    filter {
      prefix = "raw/"
    }
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# Create data lake folder structure
resource "aws_s3_object" "folders" {
  for_each = toset([
    "raw/matches/",
    "raw/events/",
    "raw/lineups/",
    "raw/live_matches/",
    "staging/matches/",
    "staging/standings/",
    "staging/top_scorers/",
    "mart/league_table/",
    "mart/recent_results/",
    "mart/top_scorers/",
    "mart/team_stats/",
    "mart/match_events/",
  ])

  bucket  = aws_s3_bucket.data_lake.id
  key     = each.value
  content = ""
}

# ─── Athena Results Bucket ────────────────────────────────────────────────────

resource "aws_s3_bucket" "athena_results" {
  bucket = "${var.project_name}-athena-results-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_lifecycle_configuration" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  rule {
    id     = "expire-results"
    status = "Enabled"
    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "athena_results" {
  bucket                  = aws_s3_bucket.athena_results.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Lambda Deployment Bucket ─────────────────────────────────────────────────

resource "aws_s3_bucket" "lambda_deploy" {
  bucket = "${var.project_name}-lambda-deploy-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "lambda_deploy" {
  bucket                  = aws_s3_bucket.lambda_deploy.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
