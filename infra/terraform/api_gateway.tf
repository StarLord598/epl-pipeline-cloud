# ─── API Gateway — EPL Pipeline REST API ──────────────────────────────────────

# ── API Lambda ────────────────────────────────────────────────────────────────

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api-${var.environment}"
  description   = "REST API for EPL pipeline data (standings, scorers, matches, health)"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      DATA_LAKE_BUCKET = aws_s3_bucket.data_lake.id
      STEP_FUNCTION_ARN = aws_sfn_state_machine.daily_pipeline.arn
      ENVIRONMENT      = var.environment
    }
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 30
}

# ── IAM: Allow API Lambda to read Step Function executions ────────────────────

resource "aws_iam_role_policy" "lambda_sfn_read" {
  name = "sfn-list-executions"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "states:ListExecutions"
      Resource = aws_sfn_state_machine.daily_pipeline.arn
    }]
  })
}

# ── REST API ──────────────────────────────────────────────────────────────────

resource "aws_api_gateway_rest_api" "epl" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "EPL Pipeline public REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# ── Resources & Methods ──────────────────────────────────────────────────────

locals {
  api_paths = ["standings", "scorers", "matches", "health"]
}

resource "aws_api_gateway_resource" "endpoints" {
  for_each    = toset(local.api_paths)
  rest_api_id = aws_api_gateway_rest_api.epl.id
  parent_id   = aws_api_gateway_rest_api.epl.root_resource_id
  path_part   = each.value
}

resource "aws_api_gateway_method" "get" {
  for_each      = toset(local.api_paths)
  rest_api_id   = aws_api_gateway_rest_api.epl.id
  resource_id   = aws_api_gateway_resource.endpoints[each.value].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "options" {
  for_each      = toset(local.api_paths)
  rest_api_id   = aws_api_gateway_rest_api.epl.id
  resource_id   = aws_api_gateway_resource.endpoints[each.value].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# ── Lambda Integration ────────────────────────────────────────────────────────

resource "aws_api_gateway_integration" "lambda_get" {
  for_each                = toset(local.api_paths)
  rest_api_id             = aws_api_gateway_rest_api.epl.id
  resource_id             = aws_api_gateway_resource.endpoints[each.value].id
  http_method             = aws_api_gateway_method.get[each.value].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# CORS mock integration for OPTIONS
resource "aws_api_gateway_integration" "options" {
  for_each    = toset(local.api_paths)
  rest_api_id = aws_api_gateway_rest_api.epl.id
  resource_id = aws_api_gateway_resource.endpoints[each.value].id
  http_method = aws_api_gateway_method.options[each.value].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  for_each    = toset(local.api_paths)
  rest_api_id = aws_api_gateway_rest_api.epl.id
  resource_id = aws_api_gateway_resource.endpoints[each.value].id
  http_method = aws_api_gateway_method.options[each.value].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  for_each    = toset(local.api_paths)
  rest_api_id = aws_api_gateway_rest_api.epl.id
  resource_id = aws_api_gateway_resource.endpoints[each.value].id
  http_method = aws_api_gateway_method.options[each.value].http_method
  status_code = aws_api_gateway_method_response.options_200[each.value].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ── Deployment & Stage ────────────────────────────────────────────────────────

resource "aws_api_gateway_deployment" "epl" {
  rest_api_id = aws_api_gateway_rest_api.epl.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.endpoints,
      aws_api_gateway_method.get,
      aws_api_gateway_integration.lambda_get,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.lambda_get,
    aws_api_gateway_integration.options,
  ]
}

resource "aws_api_gateway_stage" "v1" {
  deployment_id = aws_api_gateway_deployment.epl.id
  rest_api_id   = aws_api_gateway_rest_api.epl.id
  stage_name    = "v1"
}

# ── Lambda Permission for API Gateway ─────────────────────────────────────────

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.epl.execution_arn}/*/*"
}
