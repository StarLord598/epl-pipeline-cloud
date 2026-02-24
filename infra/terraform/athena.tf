# ─── Athena Workgroup ─────────────────────────────────────────────────────────

resource "aws_athena_workgroup" "epl" {
  name        = "${var.project_name}-${var.environment}"
  description = "EPL Pipeline Athena workgroup"
  state       = "ENABLED"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.id}/query-results/"

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }
}

# ─── Named Queries ────────────────────────────────────────────────────────────

resource "aws_athena_named_query" "league_standings" {
  name        = "league-standings"
  workgroup   = aws_athena_workgroup.epl.name
  database    = aws_glue_catalog_database.epl.name
  description = "Current EPL league standings"
  query       = <<-EOQ
    SELECT position, team_name, played, won, drawn, lost, points,
           goals_for, goals_against, goal_difference
    FROM mart_league_table
    ORDER BY position
  EOQ
}

resource "aws_athena_named_query" "recent_results" {
  name        = "recent-results"
  workgroup   = aws_athena_workgroup.epl.name
  database    = aws_glue_catalog_database.epl.name
  description = "Recent match results"
  query       = <<-EOQ
    SELECT match_id, utc_date, home_team_name, away_team_name,
           home_score, away_score, status
    FROM raw_live_matches
    WHERE status = 'FINISHED'
    ORDER BY utc_date DESC
    LIMIT 20
  EOQ
}
