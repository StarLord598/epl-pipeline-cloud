# ─── CloudWatch Dashboard & Alarms ────────────────────────────────────────────

# ── SNS Topic for Alerts ──────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-${var.environment}"
}

# ── CloudWatch Dashboard ──────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "epl_pipeline" {
  dashboard_name = "${var.project_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: Lambda Invocations
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Invocations"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.daily_ingest.function_name, { stat = "Sum", label = "Daily Ingest" }],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.live_matches.function_name, { stat = "Sum", label = "Live Matches" }],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.backfill.function_name, { stat = "Sum", label = "Backfill" }],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.data_quality.function_name, { stat = "Sum", label = "Data Quality" }],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.api.function_name, { stat = "Sum", label = "API" }],
          ]
          period = 86400
          view   = "timeSeries"
        }
      },
      # Row 1: Lambda Errors
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Errors"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.daily_ingest.function_name, { stat = "Sum", label = "Daily Ingest" }],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.live_matches.function_name, { stat = "Sum", label = "Live Matches" }],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.backfill.function_name, { stat = "Sum", label = "Backfill" }],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.data_quality.function_name, { stat = "Sum", label = "Data Quality" }],
          ]
          period = 86400
          view   = "timeSeries"
        }
      },
      # Row 2: Lambda Duration (avg + p99)
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Duration — Average (ms)"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.daily_ingest.function_name, { stat = "Average", label = "Daily Ingest" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.live_matches.function_name, { stat = "Average", label = "Live Matches" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.backfill.function_name, { stat = "Average", label = "Backfill" }],
          ]
          period = 86400
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Duration — p99 (ms)"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.daily_ingest.function_name, { stat = "p99", label = "Daily Ingest" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.live_matches.function_name, { stat = "p99", label = "Live Matches" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.backfill.function_name, { stat = "p99", label = "Backfill" }],
          ]
          period = 86400
          view   = "timeSeries"
        }
      },
      # Row 3: S3 Bucket Size + Step Functions
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "S3 Data Lake — Bucket Size"
          region = var.aws_region
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.data_lake.id, "StorageType", "StandardStorage", { stat = "Average", label = "Total Size (bytes)" }],
            ["AWS/S3", "NumberOfObjects", "BucketName", aws_s3_bucket.data_lake.id, "StorageType", "AllStorageTypes", { stat = "Average", label = "Object Count", yAxis = "right" }],
          ]
          period = 86400
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "Step Functions — Execution Status"
          region = var.aws_region
          metrics = [
            ["AWS/States", "ExecutionsStarted", "StateMachineArn", aws_sfn_state_machine.daily_pipeline.arn, { stat = "Sum", label = "Started" }],
            ["AWS/States", "ExecutionsSucceeded", "StateMachineArn", aws_sfn_state_machine.daily_pipeline.arn, { stat = "Sum", label = "Succeeded" }],
            ["AWS/States", "ExecutionsFailed", "StateMachineArn", aws_sfn_state_machine.daily_pipeline.arn, { stat = "Sum", label = "Failed" }],
            ["AWS/States", "ExecutionsTimedOut", "StateMachineArn", aws_sfn_state_machine.daily_pipeline.arn, { stat = "Sum", label = "Timed Out" }],
          ]
          period = 86400
          view   = "timeSeries"
        }
      },
    ]
  })
}

# ── CloudWatch Alarms ─────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "daily_ingest_errors" {
  alarm_name          = "${var.project_name}-daily-ingest-errors-${var.environment}"
  alarm_description   = "Daily ingest Lambda has errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.daily_ingest.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "live_matches_errors" {
  alarm_name          = "${var.project_name}-live-matches-errors-${var.environment}"
  alarm_description   = "Live matches Lambda has errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.live_matches.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "backfill_errors" {
  alarm_name          = "${var.project_name}-backfill-errors-${var.environment}"
  alarm_description   = "Backfill Lambda has errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.backfill.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "step_function_failures" {
  alarm_name          = "${var.project_name}-sfn-failures-${var.environment}"
  alarm_description   = "Step Function execution failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsFailed"
  namespace           = "AWS/States"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    StateMachineArn = aws_sfn_state_machine.daily_pipeline.arn
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}
