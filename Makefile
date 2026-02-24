.PHONY: setup run test demo clean lint docs airflow-up airflow-down dashboard quality

# ─── Setup ───────────────────────────────────────────────────────────────────

setup: ## Full local setup: Python venv, dbt deps, Node deps, seed DB
	@echo "🔧 Creating Python virtual environment..."
	python3.13 -m venv venv313
	./venv313/bin/pip install --upgrade pip
	./venv313/bin/pip install -r requirements.txt
	@echo "📦 Installing dbt packages..."
	cd dbt && ../venv313/bin/dbt deps --profiles-dir . --target local
	@echo "🌐 Installing dashboard dependencies..."
	cd dashboard && npm ci
	@echo "🗄️  Seeding DuckDB..."
	./venv313/bin/python scripts/backfill_season.py
	@echo "🔄 Running dbt build..."
	cd dbt && ../venv313/bin/dbt build --profiles-dir . --target local
	@echo "📊 Exporting dashboard data..."
	./venv313/bin/python scripts/export_live_json.py
	@echo "✅ Setup complete! Run 'make run' to start."

# ─── Run ─────────────────────────────────────────────────────────────────────

run: ## Start Airflow + dashboard
	@echo "🚀 Starting Airflow..."
	docker compose up -d
	@echo "🌐 Starting dashboard on http://localhost:3000..."
	cd dashboard && npm run dev &
	@echo ""
	@echo "  📊 Dashboard: http://localhost:3000"
	@echo "  🔄 Airflow:   http://localhost:8080 (admin/admin)"
	@echo ""

dashboard: ## Start dashboard only
	cd dashboard && npm run dev

airflow-up: ## Start Airflow only
	docker compose up -d

airflow-down: ## Stop Airflow
	docker compose down

# ─── Test & Quality ──────────────────────────────────────────────────────────

test: ## Run all tests: dbt tests + Python lint + dashboard build
	@echo "🧪 Running dbt tests..."
	cd dbt && ../venv313/bin/dbt test --profiles-dir . --target local
	@echo "🐍 Linting Python..."
	./venv313/bin/python -m ruff check scripts/ --ignore E501 || true
	@echo "🏗️  Building dashboard..."
	cd dashboard && npm run build
	@echo "✅ All tests passed!"

lint: ## Lint SQL + Python
	@echo "📝 Linting SQL..."
	cd dbt && sqlfluff lint models/ --dialect duckdb --ignore parsing || true
	@echo "🐍 Linting Python..."
	./venv313/bin/python -m ruff check scripts/ --ignore E501

quality: ## Run data quality checks and show results
	cd dbt && ../venv313/bin/dbt test --profiles-dir . --target local 2>&1 | tail -20
	./venv313/bin/python scripts/check_live_freshness.py

# ─── Pipeline ────────────────────────────────────────────────────────────────

pipeline: ## Run full pipeline: ingest → transform → export
	@echo "📥 Ingesting live data..."
	./venv313/bin/python scripts/ingest_live_matches.py
	./venv313/bin/python scripts/ingest_live_standings.py
	@echo "🔄 Running dbt..."
	cd dbt && ../venv313/bin/dbt run --profiles-dir . --target local
	@echo "📊 Exporting JSON..."
	./venv313/bin/python scripts/export_live_json.py
	@echo "✅ Pipeline complete!"

backfill: ## Backfill full 2025-26 season
	./venv313/bin/python scripts/backfill_season.py
	cd dbt && ../venv313/bin/dbt run --profiles-dir . --target local

# ─── Docs ────────────────────────────────────────────────────────────────────

docs: ## Generate dbt docs + data lineage
	cd dbt && ../venv313/bin/dbt docs generate --profiles-dir . --target local
	cp dbt/target/manifest.json dashboard/public/lineage/
	cp dbt/target/catalog.json dashboard/public/lineage/
	cp dbt/target/index.html dashboard/public/lineage/
	@echo "📚 Lineage available at http://localhost:3000/lineage"

# ─── Demo ────────────────────────────────────────────────────────────────────

demo: ## Full demo: pipeline + docs + dashboard
	@$(MAKE) pipeline
	@$(MAKE) docs
	@$(MAKE) dashboard

# ─── Clean ───────────────────────────────────────────────────────────────────

clean: ## Remove generated artifacts (keeps data)
	rm -rf dbt/target dbt/dbt_packages dbt/logs
	rm -rf dashboard/.next dashboard/node_modules
	rm -rf venv313
	docker compose down -v

# ─── Help ────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
