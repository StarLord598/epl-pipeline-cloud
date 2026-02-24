# ─── Secrets Manager ──────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${var.project_name}/${var.environment}/api-keys"
  description = "API keys for EPL Pipeline data sources"

  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id

  secret_string = jsonencode({
    FOOTBALL_DATA_API_KEY = var.football_data_api_key
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
