# Live + Batch Pipeline Spec (Portfolio Upgrade)

## Objective
Add a continuous ingestion layer on top of the existing batch pipeline to demonstrate production-style orchestration, monitoring, and data freshness.

## Live Source
- Primary: `football-data.org` (free tier)
- Pull frequency:
  - Every 15 min during match windows
  - Hourly baseline outside match windows

## New DAGs

### 1) `live_poll_15m`
**Schedule:** `*/15 * * * *`

Tasks:
1. `fetch_matches_live` – pull live/updated fixtures for current day
2. `fetch_standings_live` – pull standings snapshot
3. `validate_raw_payloads` – schema + null checks
4. `load_raw_live_tables` – write to DuckDB raw tables
5. `run_dbt_live_silver` – build `silver_live_match_state`
6. `run_monitoring_checks` – freshness + lag checks
7. `log_pipeline_run` – write run metadata

### 2) `hourly_refresh`
**Schedule:** `0 * * * *`

Tasks:
1. `backfill_recent_matches` (last 48h updates)
2. `refresh_standings`
3. `run_dbt_gold_live`
4. `publish_live_json`

### 3) `daily_reconcile`
**Schedule:** `0 2 * * *`

Tasks:
1. `run_batch_ingest`
2. `run_dbt_full`
3. `run_dbt_tests`
4. `reconcile_live_vs_batch`
5. `export_dashboard_json`
6. `write_daily_quality_report`

---

## New Tables

### Raw
- `raw_live_matches`
- `raw_live_standings`
- `raw_pipeline_runs`

### Silver
- `silver_live_match_state`
  - one latest state per match
  - dedup by `(match_id, status_timestamp)`

### Gold
- `gold_live_match_monitor`
  - freshness minutes
  - last successful pull
  - lag SLA pass/fail

---

## Monitoring SLAs
- Match-day freshness: `< 20 minutes`
- Non-match-day freshness: `< 90 minutes`
- DAG success target: `>= 99%`

Alert conditions:
- No successful pull in > 30 min (match-day)
- 2 consecutive DAG failures
- Raw payload schema mismatch

---

## Immediate Build Order
1. Add ingestion script for football-data.org live endpoints
2. Create `raw_live_matches` / `raw_live_standings` tables
3. Implement `live_poll_15m` DAG
4. Add dbt silver model `silver_live_match_state`
5. Add monitoring table + freshness check task

---

## Notes
- Keep existing batch pipeline unchanged.
- Live layer is additive and portfolio-focused.
- Designed to migrate cleanly from DuckDB to BigQuery later.
