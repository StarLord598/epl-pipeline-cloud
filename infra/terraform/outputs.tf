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

# ─── Cloud Enhancement Outputs ────────────────────────────────────────────────

output "api_url" {
  description = "API Gateway base URL"
  value       = "${aws_api_gateway_stage.v1.invoke_url}"
}

output "cloudfront_url" {
  description = "CloudFront distribution URL for the API"
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "dashboard_url" {
  description = "CloudWatch Dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.epl_pipeline.dashboard_name}"
}

output "step_function_arn" {
  description = "Step Functions state machine ARN"
  value       = aws_sfn_state_machine.daily_pipeline.arn
}

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for pipeline alerts"
  value       = aws_sns_topic.alerts.arn
}

output "sns_notifications_topic_arn" {
  description = "SNS topic ARN for pipeline notifications"
  value       = aws_sns_topic.pipeline_notifications.arn
}


