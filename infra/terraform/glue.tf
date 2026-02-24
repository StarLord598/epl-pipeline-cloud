# ─── Glue Catalog Database & Tables ───────────────────────────────────────────

resource "aws_glue_catalog_database" "epl" {
  name        = "${replace(var.project_name, "-", "_")}_${var.environment}"
  description = "EPL Pipeline data catalog — ${var.environment}"
}

# ── Raw Layer Tables ──────────────────────────────────────────────────────────

resource "aws_glue_catalog_table" "raw_matches" {
  database_name = aws_glue_catalog_database.epl.name
  name          = "raw_matches"

  table_type = "EXTERNAL_TABLE"
  parameters = {
    "classification" = "parquet"
    EXTERNAL         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.data_lake.id}/raw/matches/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "match_id"
      type = "int"
    }
    columns {
      name = "competition_id"
      type = "int"
    }
    columns {
      name = "competition_name"
      type = "string"
    }
    columns {
      name = "season_id"
      type = "int"
    }
    columns {
      name = "season_name"
      type = "string"
    }
    columns {
      name = "match_date"
      type = "date"
    }
    columns {
      name = "home_team_id"
      type = "int"
    }
    columns {
      name = "home_team_name"
      type = "string"
    }
    columns {
      name = "away_team_id"
      type = "int"
    }
    columns {
      name = "away_team_name"
      type = "string"
    }
    columns {
      name = "home_score"
      type = "int"
    }
    columns {
      name = "away_score"
      type = "int"
    }
    columns {
      name = "match_status"
      type = "string"
    }
    columns {
      name = "matchday"
      type = "int"
    }
    columns {
      name = "ingested_at"
      type = "timestamp"
    }
  }
}

resource "aws_glue_catalog_table" "raw_live_matches" {
  database_name = aws_glue_catalog_database.epl.name
  name          = "raw_live_matches"

  table_type = "EXTERNAL_TABLE"
  parameters = {
    "classification" = "parquet"
    EXTERNAL         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.data_lake.id}/raw/live_matches/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "source"
      type = "string"
    }
    columns {
      name = "match_id"
      type = "string"
    }
    columns {
      name = "competition"
      type = "string"
    }
    columns {
      name = "season"
      type = "string"
    }
    columns {
      name = "utc_date"
      type = "string"
    }
    columns {
      name = "status"
      type = "string"
    }
    columns {
      name = "minute"
      type = "int"
    }
    columns {
      name = "home_team_name"
      type = "string"
    }
    columns {
      name = "away_team_name"
      type = "string"
    }
    columns {
      name = "home_score"
      type = "int"
    }
    columns {
      name = "away_score"
      type = "int"
    }
    columns {
      name = "winner"
      type = "string"
    }
    columns {
      name = "ingested_at"
      type = "timestamp"
    }
  }

  partition_keys {
    name = "ingestion_date"
    type = "string"
  }
}

resource "aws_glue_catalog_table" "raw_events" {
  database_name = aws_glue_catalog_database.epl.name
  name          = "raw_events"

  table_type = "EXTERNAL_TABLE"
  parameters = {
    "classification" = "parquet"
    EXTERNAL         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.data_lake.id}/raw/events/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "event_id"
      type = "string"
    }
    columns {
      name = "match_id"
      type = "int"
    }
    columns {
      name = "period"
      type = "int"
    }
    columns {
      name = "minute"
      type = "int"
    }
    columns {
      name = "second"
      type = "int"
    }
    columns {
      name = "event_type"
      type = "string"
    }
    columns {
      name = "team_name"
      type = "string"
    }
    columns {
      name = "player_name"
      type = "string"
    }
    columns {
      name = "location_x"
      type = "float"
    }
    columns {
      name = "location_y"
      type = "float"
    }
    columns {
      name = "sub_type"
      type = "string"
    }
    columns {
      name = "outcome"
      type = "string"
    }
    columns {
      name = "ingested_at"
      type = "timestamp"
    }
  }
}

# ── Mart Layer Tables ─────────────────────────────────────────────────────────

resource "aws_glue_catalog_table" "mart_league_table" {
  database_name = aws_glue_catalog_database.epl.name
  name          = "mart_league_table"

  table_type = "EXTERNAL_TABLE"
  parameters = {
    "classification" = "parquet"
    EXTERNAL         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.data_lake.id}/mart/league_table/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "position"
      type = "int"
    }
    columns {
      name = "team_id"
      type = "int"
    }
    columns {
      name = "team_name"
      type = "string"
    }
    columns {
      name = "played"
      type = "int"
    }
    columns {
      name = "won"
      type = "int"
    }
    columns {
      name = "drawn"
      type = "int"
    }
    columns {
      name = "lost"
      type = "int"
    }
    columns {
      name = "points"
      type = "int"
    }
    columns {
      name = "goals_for"
      type = "int"
    }
    columns {
      name = "goals_against"
      type = "int"
    }
    columns {
      name = "goal_difference"
      type = "int"
    }
  }
}
