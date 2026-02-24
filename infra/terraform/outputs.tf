output "data_lake_bucket" {
  description = "S3 data lake bucket name"
  value       = aws_s3_bucket.data_lake.id
}

output "athena_results_bucket" {
  description = "S3 bucket for Athena query results"
  value       = aws_s3_bucket.athena_results.id
}

output "glue_database_name" {
  description = "Glue Catalog database name"
  value       = aws_glue_catalog_database.epl.name
}

output "athena_workgroup" {
  description = "Athena workgroup name"
  value       = aws_athena_workgroup.epl.name
}

output "lambda_daily_ingest_arn" {
  description = "Daily ingest Lambda ARN"
  value       = aws_lambda_function.daily_ingest.arn
}

output "lambda_live_matches_arn" {
  description = "Live matches Lambda ARN"
  value       = aws_lambda_function.live_matches.arn
}

output "lambda_backfill_arn" {
  description = "Backfill Lambda ARN"
  value       = aws_lambda_function.backfill.arn
}

output "secret_arn" {
  description = "Secrets Manager ARN for API keys"
  value       = aws_secretsmanager_secret.api_keys.arn
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}
