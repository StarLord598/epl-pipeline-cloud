# ─── Step Functions Orchestration ──────────────────────────────────────────────
# Replaces direct EventBridge→Lambda with a state machine:
# 1. Daily Ingest → 2. Data Quality Check → 3. SNS Notification

# ── SNS Topic for Pipeline Notifications ──────────────────────────────────────

resource "aws_sns_topic" "pipeline_notifications" {
  name = "${var.project_name}-pipeline-notifications-${var.environment}"
}

# ── Data Quality Lambda ───────────────────────────────────────────────────────

resource "aws_lambda_function" "data_quality" {
  function_name = "${var.project_name}-data-quality-${var.environment}"
  description   = "Data quality validation for EPL pipeline S3 objects"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.11"
  timeout       = 120
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      DATA_LAKE_BUCKET = aws_s3_bucket.data_lake.id
      ENVIRONMENT      = var.environment
    }
  }
}

resource "aws_cloudwatch_log_group" "data_quality" {
  name              = "/aws/lambda/${aws_lambda_function.data_quality.function_name}"
  retention_in_days = 30
}

# ── Step Functions IAM Role ───────────────────────────────────────────────────

resource "aws_iam_role" "step_functions_exec" {
  name = "${var.project_name}-sfn-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "states.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "step_functions_policy" {
  name = "sfn-invoke-lambdas-sns"
  role = aws_iam_role.step_functions_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.daily_ingest.arn,
          aws_lambda_function.data_quality.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.pipeline_notifications.arn
      }
    ]
  })
}

# ── State Machine ─────────────────────────────────────────────────────────────

resource "aws_sfn_state_machine" "daily_pipeline" {
  name     = "${var.project_name}-daily-pipeline-${var.environment}"
  role_arn = aws_iam_role.step_functions_exec.arn

  definition = jsonencode({
    Comment = "EPL Pipeline Daily Orchestration: Ingest → Quality Check → Notify"
    StartAt = "DailyIngest"
    States = {
      DailyIngest = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.daily_ingest.arn
          Payload = {
            source    = "step_functions"
            action    = "full_ingest"
            "timestamp.$" = "$$.Execution.StartTime"
          }
        }
        ResultPath = "$.ingest_result"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed", "Lambda.ServiceException"]
          IntervalSeconds = 60
          MaxAttempts     = 2
          BackoffRate     = 2.0
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "NotifyFailure"
          ResultPath  = "$.error"
        }]
        Next = "DataQualityCheck"
      }

      DataQualityCheck = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.data_quality.arn
          Payload = {
            "ingest_result.$" = "$.ingest_result"
          }
        }
        ResultSelector = {
          "quality_result.$" = "$.Payload"
        }
        ResultPath = "$.quality"
        Retry = [{
          ErrorEquals     = ["States.TaskFailed"]
          IntervalSeconds = 30
          MaxAttempts     = 1
          BackoffRate     = 1.0
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "NotifyFailure"
          ResultPath  = "$.error"
        }]
        Next = "CheckQualityResult"
      }

      CheckQualityResult = {
        Type = "Choice"
        Choices = [{
          Variable     = "$.quality.quality_result.overall_status"
          StringEquals = "PASS"
          Next         = "NotifySuccess"
        }]
        Default = "NotifyFailure"
      }

      NotifySuccess = {
        Type     = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = aws_sns_topic.pipeline_notifications.arn
          Subject  = "✅ EPL Pipeline — Daily Run Succeeded"
          Message = {
            "Fn.States.Format" = "Pipeline completed successfully.\nExecution: {}\nQuality: {}"
            "Args.$"           = "States.Array($$.Execution.Id, $.quality.quality_result.overall_status)"
          }
        }
        End = true
      }

      NotifyFailure = {
        Type     = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = aws_sns_topic.pipeline_notifications.arn
          Subject  = "❌ EPL Pipeline — Daily Run Failed"
          "Message.$" = "States.Format('Pipeline failed.\nExecution: {}\nError: {}', $$.Execution.Id, States.JsonToString($.error))"
        }
        End = true
      }
    }
  })
}

# ── EventBridge → Step Functions (replaces direct Lambda trigger) ─────────────

resource "aws_cloudwatch_event_rule" "daily_pipeline_sfn" {
  name                = "${var.project_name}-daily-pipeline-sfn-${var.environment}"
  description         = "Trigger daily EPL pipeline Step Function"
  schedule_expression = "cron(0 6 * * ? *)"
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "daily_pipeline_sfn" {
  rule     = aws_cloudwatch_event_rule.daily_pipeline_sfn.name
  arn      = aws_sfn_state_machine.daily_pipeline.arn
  role_arn = aws_iam_role.eventbridge_sfn.arn

  input = jsonencode({
    source = "eventbridge_schedule"
  })
}

resource "aws_iam_role" "eventbridge_sfn" {
  name = "${var.project_name}-eb-sfn-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "eventbridge_sfn_policy" {
  name = "start-step-function"
  role = aws_iam_role.eventbridge_sfn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "states:StartExecution"
      Resource = aws_sfn_state_machine.daily_pipeline.arn
    }]
  })
}
