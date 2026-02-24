#!/bin/bash
# EPL Pipeline — Full run script
# Runs all pipeline steps: ingest → transform → export
# Usage: ./scripts/run_pipeline.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$REPO_ROOT/venv313"
PYTHON="$VENV/bin/python3"
DBT="$VENV/bin/dbt"

echo "🏟️  EPL Analytics Pipeline"
echo "  Repo: $REPO_ROOT"
echo "  DB:   $REPO_ROOT/data/epl_pipeline.duckdb"
echo ""

# Activate venv
source "$VENV/bin/activate"

# 1. Ingest StatsBomb events (Arsenal 2003/04 Invincibles)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: StatsBomb Event Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
python3 "$REPO_ROOT/scripts/ingest_data.py"

# 2. Ingest full 2023-24 season
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: 2023-24 Full Season Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
python3 "$REPO_ROOT/scripts/ingest_full_season.py"

# 3. Run dbt
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: dbt Transforms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$REPO_ROOT/dbt"
EPL_DB_PATH="$REPO_ROOT/data/epl_pipeline.duckdb" "$DBT" run
EPL_DB_PATH="$REPO_ROOT/data/epl_pipeline.duckdb" "$DBT" test
cd "$REPO_ROOT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PIPELINE COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: Start the dashboard"
echo "  cd dashboard && npm run dev"
echo "  Open http://localhost:3000"
