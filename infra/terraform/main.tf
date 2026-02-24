# ─── EPL Pipeline — AWS Cloud Infrastructure ─────────────────────────────────
# Terraform configuration for the EPL data engineering pipeline cloud layer.
# Resources: S3 data lake, Glue Catalog, Athena, Lambda, EventBridge, Secrets Manager

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "epl-pipeline-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "epl-pipeline-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
