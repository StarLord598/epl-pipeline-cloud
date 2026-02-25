variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "epl-pipeline"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "football_data_api_key" {
  description = "football-data.org API key (stored in Secrets Manager)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "lambda_memory_size" {
  description = "Memory (MB) for Lambda functions"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Timeout (seconds) for Lambda functions"
  type        = number
  default     = 300
}

variable "github_org" {
  description = "GitHub org/user for OIDC provider"
  type        = string
  default     = "StarLord598"
}

variable "github_repo" {
  description = "GitHub repo name for OIDC provider"
  type        = string
  default     = "epl-pipeline-cloud"
}


