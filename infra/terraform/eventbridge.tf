# ─── EventBridge Schedules ────────────────────────────────────────────────────

# Daily ingest — runs at 6 AM UTC (1 AM EST) every day
resource "aws_cloudwatch_event_rule" "daily_ingest" {
  name                = "${var.project_name}-daily-ingest-${var.environment}"
  description         = "Trigger daily EPL data ingestion"
  schedule_expression = "cron(0 6 * * ? *)"
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "daily_ingest" {
  rule = aws_cloudwatch_event_rule.daily_ingest.name
  arn  = aws_lambda_function.daily_ingest.arn

  input = jsonencode({
    source    = "scheduled"
    action    = "full_ingest"
    timestamp = "$.time"
  })
}

resource "aws_lambda_permission" "daily_ingest_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.daily_ingest.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_ingest.arn
}

# Live matches — runs every 15 minutes during match windows (Sat/Sun 12-22 UTC)
resource "aws_cloudwatch_event_rule" "live_matches" {
  name                = "${var.project_name}-live-matches-${var.environment}"
  description         = "Trigger live match ingestion during match windows"
  schedule_expression = "rate(15 minutes)"
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "live_matches" {
  rule = aws_cloudwatch_event_rule.live_matches.name
  arn  = aws_lambda_function.live_matches.arn

  input = jsonencode({
    source = "scheduled"
    action = "live_ingest"
  })
}

resource "aws_lambda_permission" "live_matches_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.live_matches.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.live_matches.arn
}

# Backfill — weekly on Monday at 7 AM UTC
resource "aws_cloudwatch_event_rule" "backfill" {
  name                = "${var.project_name}-backfill-${var.environment}"
  description         = "Weekly season backfill"
  schedule_expression = "cron(0 7 ? * MON *)"
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "backfill" {
  rule = aws_cloudwatch_event_rule.backfill.name
  arn  = aws_lambda_function.backfill.arn

  input = jsonencode({
    source = "scheduled"
    action = "backfill"
  })
}

resource "aws_lambda_permission" "backfill_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backfill.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.backfill.arn
}
