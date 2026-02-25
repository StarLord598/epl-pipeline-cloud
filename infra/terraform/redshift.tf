# ─── Redshift Serverless ──────────────────────────────────────────────────────
# Namespace + Workgroup for EPL Pipeline analytics.
# Scales to zero when idle = $0 cost. Base capacity = 8 RPU (minimum).

# ─── Default VPC + Subnets ────────────────────────────────────────────────────

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ─── Security Group ──────────────────────────────────────────────────────────

resource "aws_security_group" "redshift_serverless" {
  name        = "${var.project_name}-redshift-${var.environment}"
  description = "Allow inbound Redshift connections (port 5439)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Redshift from anywhere (portfolio project)"
    from_port   = 5439
    to_port     = 5439
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-redshift-${var.environment}"
  }
}

# ─── IAM Role for Redshift S3 Access ─────────────────────────────────────────

resource "aws_iam_role" "redshift_s3_access" {
  name = "${var.project_name}-redshift-s3-access-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "redshift.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "redshift_s3_read" {
  name = "s3-data-lake-read"
  role = aws_iam_role.redshift_s3_access.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetBucketLocation",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.data_lake.arn,
          "${aws_s3_bucket.data_lake.arn}/*"
        ]
      }
    ]
  })
}

# ─── Secrets Manager — Redshift Admin Credentials ────────────────────────────

resource "random_password" "redshift_admin" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+"
}

resource "aws_secretsmanager_secret" "redshift_admin" {
  name        = "${var.project_name}/${var.environment}/redshift-admin"
  description = "Redshift Serverless admin credentials"
}

resource "aws_secretsmanager_secret_version" "redshift_admin" {
  secret_id = aws_secretsmanager_secret.redshift_admin.id
  secret_string = jsonencode({
    username = var.redshift_admin_username
    password = random_password.redshift_admin.result
  })
}

# ─── Redshift Serverless Namespace ───────────────────────────────────────────

resource "aws_redshiftserverless_namespace" "epl" {
  namespace_name      = "${var.project_name}-${var.environment}"
  db_name             = "dev"
  admin_username      = var.redshift_admin_username
  admin_user_password = random_password.redshift_admin.result
  iam_roles           = [aws_iam_role.redshift_s3_access.arn]

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

# ─── Redshift Serverless Workgroup ───────────────────────────────────────────

resource "aws_redshiftserverless_workgroup" "epl" {
  namespace_name = aws_redshiftserverless_namespace.epl.namespace_name
  workgroup_name = "${var.project_name}-${var.environment}"
  base_capacity  = var.redshift_base_capacity

  publicly_accessible = true
  security_group_ids  = [aws_security_group.redshift_serverless.id]
  subnet_ids          = data.aws_subnets.default.ids

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

# ─── S3→Redshift Loader Lambda ───────────────────────────────────────────────

data "archive_file" "s3_to_redshift" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda/s3_to_redshift"
  output_path = "${path.module}/../../.build/s3_to_redshift.zip"
}

resource "aws_lambda_function" "s3_to_redshift" {
  function_name    = "${var.project_name}-s3-to-redshift-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size
  filename         = data.archive_file.s3_to_redshift.output_path
  source_code_hash = data.archive_file.s3_to_redshift.output_base64sha256

  environment {
    variables = {
      DATA_LAKE_BUCKET    = aws_s3_bucket.data_lake.id
      REDSHIFT_WORKGROUP  = aws_redshiftserverless_workgroup.epl.workgroup_name
      REDSHIFT_DATABASE   = "dev"
      REDSHIFT_IAM_ROLE   = aws_iam_role.redshift_s3_access.arn
      REDSHIFT_SECRET_ARN = aws_secretsmanager_secret.redshift_admin.arn
    }
  }

  tags = {
    Name = "${var.project_name}-s3-to-redshift-${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "s3_to_redshift" {
  name              = "/aws/lambda/${aws_lambda_function.s3_to_redshift.function_name}"
  retention_in_days = 14
}
