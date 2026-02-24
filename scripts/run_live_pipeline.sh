#!/bin/bash
# Live EPL pipeline demo runner
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Local dev uses venv313; Airflow docker image uses system python.
VENV="$REPO_ROOT/venv313"
if [ -x "$VENV/bin/python" ]; then
  PY="$VENV/bin/python"
  # shellcheck disable=SC1090
  source "$VENV/bin/activate"
else
  PY="python3"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "LIVE PIPELINE DEMO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

$PY "$REPO_ROOT/scripts/ingest_live_matches.py"
$PY "$REPO_ROOT/scripts/ingest_live_standings.py"
$PY "$REPO_ROOT/scripts/validate_live_payloads.py"
$PY "$REPO_ROOT/scripts/check_live_freshness.py"
$PY "$REPO_ROOT/scripts/export_live_monitor_json.py"

echo ""
echo "✅ Live pipeline demo complete"
echo "   Table: raw.live_matches"
echo "   Table: raw.live_standings"
echo "   View : staging.silver_live_match_state"
echo "   Table: mart.gold_live_match_monitor"
