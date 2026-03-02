# ⚽ EPL Cloud Analytics Pipeline

> **A production-grade cloud data engineering platform** that ingests, transforms, tests, and serves Premier League data — orchestrated locally by Airflow and in the cloud by AWS Step Functions, modeled in dbt, stored in DuckDB (local) and S3 (cloud), and served through a modern Next.js dashboard deployed on Vercel.

🔗 **[Live Dashboard →](https://andres-alvarez-de-cloud-epl-analytics.vercel.app)**

[![CI — EPL Pipeline](https://github.com/StarLord598/epl-pipeline-cloud/actions/workflows/ci.yml/badge.svg)](https://github.com/StarLord598/epl-pipeline-cloud/actions)
![dbt](https://img.shields.io/badge/dbt-18%20models-orange)
![Tests](https://img.shields.io/badge/tests-37%20passing-brightgreen)
![Streaming](https://img.shields.io/badge/streaming-SSE%20replay-blueviolet)
![AWS](https://img.shields.io/badge/cloud-AWS-FF9900?logo=amazonaws)
![Vercel](https://img.shields.io/badge/dashboard-Vercel-000?logo=vercel)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🏗️ Architecture

This project has **two deployment targets** that work simultaneously:

| | Local | Cloud |
|---|---|---|
| **Storage** | DuckDB (embedded OLAP) | S3 Data Lake (Parquet) |
| **Orchestration** | Airflow (Docker) | Step Functions + EventBridge |
| **Ingestion** | Python scripts | AWS Lambda (x5) |
| **Query Engine** | DuckDB | Athena (serverless SQL on S3) |
| **dbt Target** | `local` (DuckDB) | `cloud` (Athena) |
| **Dashboard** | `localhost:3000` | [Vercel](https://andres-alvarez-de-cloud-epl-analytics.vercel.app) (auto-deploy from `main`) |
| **Public API** | Next.js API Routes | API Gateway + CloudFront |
| **Monitoring** | — | CloudWatch Dashboard + Alarms + SNS |
| **IaC** | Docker Compose | Terraform (1,762 lines, 14 files, 62 resources) |
| **CI/CD** | — | GitHub Actions (OIDC, no static keys) |

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│  football-data.org ── StatsBomb Open Data ── Open-Meteo ── TheSportsDB │
│  (live scores)        (129K match events)   (weather)    (fallback)   │
└──────────┬─────────────────────────┬──────────────────────┬─────────┘
           │                         │                      │
     ┌─────┴──────────┐        ┌────┴──────┐          ┌────┴────┐
     │  AWS Lambda x5 │        │  Python   │          │Open-Meteo│
     │  (cloud ingest)│        │  scripts  │          │  API     │
     └─────┬──────────┘        │  (local)  │          └────┬────┘
           │                   └────┬──────┘               │
           ▼                        ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────────────────────┐
│  S3 Data Lake    │   │           DuckDB (local OLAP)                │
│  (Parquet)       │   │                                              │
│  raw/ stg/ mart/ │   │  🥉 Bronze (7 tables) → 🥈 Silver (6 views) │
└────────┬─────────┘   │  → 🥇 Gold (12 tables)                      │
         │             └──────────────────┬───────────────────────────┘
         ▼                                │
┌──────────────────┐           ┌──────────┴───────────────────────────┐
│  Athena + Glue   │           │      dbt (18 models, 37 tests)       │
│  (cloud query)   │           └──────────┬───────────────────────────┘
└──────────────────┘                      │
                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Next.js 14 + Vercel)                    │
│                                                                      │
│  12 pages: Table · Race · Form · Live · Results · Scorers · Stats   │
│           Stream · Weather · Quality · Lineage · Health              │
│                                                                      │
│  12 API routes (REST + SSE streaming)                                │
│  🔗 andres-alvarez-de-cloud-epl-analytics.vercel.app                │
└──────────────────────────────────────────────────────────────────────┘
```

For the detailed AWS Mermaid diagram, see [docs/AWS_ARCHITECTURE.md](docs/AWS_ARCHITECTURE.md).

---

## ✨ Key Features

### Data Engineering Patterns
| Pattern | Implementation | Details |
|---------|---------------|---------|
| **Medallion Architecture** | Bronze → Silver → Gold | 7 raw tables, 6 staging views, 12 Gold tables |
| **SCD Type 1** | `mart_scd1_matches` | Upsert pattern — tracks corrections, update counts, first/last seen |
| **SCD Type 2** | `mart_scd2_standings` | Pure versioned history — only creates rows on position change, with `valid_from`/`valid_to` boundaries |
| **Real-Time Weather** | `mart_stadium_weather` | Live conditions at 20 EPL stadiums via Open-Meteo (free, no key) |
| **Event Streaming (SSE)** | Match replay endpoint | Server-Sent Events stream 3,500+ events per match in real-time |
| **Kimball Dimensions** | `dim_teams`, `dim_matchdays` | Fact/dimension modeling with tier classification |
| **Rolling Aggregations** | `mart_rolling_form` | 5-game rolling PPG, momentum classification (HOT/COLD) |
| **Cumulative Metrics** | `mart_points_race` | Running point totals per team per matchday |
| **Incremental Models** | `mart_recent_results` | Append-only — only processes new matches |
| **Matchday-Aware Scheduling** | `ShortCircuitOperator` | Skips API polling on non-matchdays to save resources |
| **Schema Contracts** | `contracts.py` | Validates API responses before Bronze insert; blocks bad batches |
| **Idempotent Backfill** | `backfill_season.py` | Safe to re-run — deduplicates on match_id |
| **Data Quality Framework** | 29 dbt tests + freshness SLAs | Uniqueness, not-null, accepted values, source freshness |

### Cloud Infrastructure (AWS)
| Component | Service | Purpose |
|-----------|---------|---------|
| **Data Lake** | S3 (Parquet, versioned, encrypted) | Medallion architecture: raw → staging → mart |
| **Ingestion** | Lambda (x5) | daily_ingest, live_matches, backfill, data_quality, api |
| **Orchestration** | Step Functions | Daily pipeline: Ingest → Quality Check → SNS Notify |
| **Scheduling** | EventBridge | SFN trigger, live matches (15 min), weekly backfill |
| **Public API** | API Gateway + CloudFront | REST endpoints with CDN caching |
| **Dashboard** | Vercel (free tier) | Auto-deploy from `main` branch |
| **Monitoring** | CloudWatch + SNS | Dashboard, 4 alarms, 2 notification topics |
| **Catalog** | Glue Catalog | Schema-on-read metadata for Athena |
| **Query Engine** | Athena | Serverless SQL analytics on S3 |
| **Secrets** | Secrets Manager | Encrypted API key storage |
| **IaC** | Terraform (14 files, 1,762 lines) | All 62 AWS resources as code |
| **CI/CD** | GitHub Actions + OIDC | Federated identity — no static AWS keys |

### Platform Stats
| Metric | Count |
|--------|-------|
| dbt Models | 18 (6 views + 11 tables + 1 incremental) |
| Data Tests | 37 passing |
| Dashboard Pages | 12 (interactive charts, live scores, streaming, weather, quality, lineage, health) |
| REST API Endpoints | 12 (including SSE streaming) |
| Airflow DAGs | 6 (with matchday-aware scheduling) |
| Terraform Resources | 62 |
| Documented Columns | 150+ |

---

## 🚀 Quick Start

### Live Dashboard (no setup required)

**[→ andres-alvarez-de-cloud-epl-analytics.vercel.app](https://andres-alvarez-de-cloud-epl-analytics.vercel.app)**

### Local Development

```bash
# Clone and setup
git clone https://github.com/StarLord598/epl-pipeline-cloud.git
cd epl-pipeline-cloud
make setup

# Run everything
make run          # Starts Airflow (localhost:8080) + Dashboard (localhost:3000)

# Or run individual components
make pipeline     # Ingest → dbt transform → JSON export
make test         # dbt tests + Python lint + dashboard build
make docs         # Regenerate data lineage
make demo         # Full pipeline + docs + dashboard
```

### Manual Setup
```bash
# Python
python3.13 -m venv venv313 && source venv313/bin/activate
pip install -r requirements.txt

# Seed data
python scripts/backfill_season.py         # Full 2025-26 season (380 matches)

# dbt
cd dbt && dbt build --profiles-dir . --target local

# Dashboard
cd dashboard && npm ci && npm run dev     # → http://localhost:3000

# Airflow
docker compose up -d                      # → http://localhost:8080 (admin/admin)
```

### Cloud Deployment (AWS)
```bash
# 1. Bootstrap (creates state bucket + lock table)
./scripts/setup_aws.sh

# 2. Deploy infrastructure (62 resources)
cd infra/terraform && terraform apply

# 3. Set API key
aws secretsmanager put-secret-value \
  --secret-id epl-pipeline/dev/api-keys \
  --secret-string '{"FOOTBALL_DATA_API_KEY":"your-key"}'

# 4. Deploy Lambda code
./scripts/deploy_lambdas.sh

# 5. Run dbt against Athena
cd dbt && dbt run --target cloud

# 6. Get your public API URL
terraform output cloudfront_url
```

### Environment Variables
```bash
cp .env.example .env
# Required: FOOTBALL_DATA_API_KEY (free at https://www.football-data.org/client/register)
```

---

## 📊 Dashboard Pages

**Live:** [andres-alvarez-de-cloud-epl-analytics.vercel.app](https://andres-alvarez-de-cloud-epl-analytics.vercel.app)

| Page | Route | DW Pattern | Data Refresh | Description |
|------|-------|------------|-------------|-------------|
| 🏆 **League Table** | `/` | Fact Table (Kimball) | ⚡ Every 15 min (live poll) + hourly | Live 2025-26 standings with qualification zones, form, per-game stats |
| 📈 **Points Race** | `/race` | Accumulating Snapshot | 🔄 Every 30 min (dbt transform) | Interactive line chart — cumulative points across matchdays |
| 🔥 **Form & Momentum** | `/form` | Rolling Window + SCD2 | 🔄 Every 30 min (dbt transform) | Hot/Cold momentum panel (rolling 5-game PPG) + position history |
| ⚡ **Live Matches** | `/live` | Transaction Fact (CDC) | ⚡ Every 15 min (matchday-aware) | Real-time scores with status badges (LIVE/HT/FT), auto-refresh |
| ⚽ **Results** | `/results` | Incremental Fact Table | 🔄 Every 30 min (dbt incremental) | Match results browseable by gameweek |
| 🎯 **Top Scorers** | `/scorers` | Star Schema (Kimball) | 🕐 Hourly refresh | Golden Boot race with bar charts |
| 📊 **Stats** | `/stats` | Conformed Dimension | 🔄 Every 30 min (dbt transform) | Radar charts, team comparisons (select up to 4 teams) |
| 📡 **Streaming Replay** | `/stream` | Event Streaming (Kafka pattern) | 📅 Daily at 6 AM (StatsBomb batch) | SSE-powered match replay — live event feed, possession bar, scoreboard |
| 🌤️ **Stadium Weather** | `/weather` | Live API Integration | 🌀 Every 5 min (Open-Meteo) | Near real-time weather at all 20 EPL stadiums — pitch conditions |
| 🛡️ **Data Quality** | `/quality` | Data Observability | 🔄 Every 30 min (dbt test suite) | Test pass rates, freshness SLAs, medallion inventory |
| 🔗 **Data Lineage** | `/lineage` | DAG Visualization | 🏗️ On dbt build | Interactive dbt docs — full dependency graph for all 18 models |
| 🏥 **Pipeline Health** | `/health` | Operational Dashboard | 📡 On-demand (live API check) | AWS cloud resource status + pipeline monitoring |

---

## 📡 REST API

All endpoints return JSON with `Cache-Control` headers. Full reference: [docs/API.md](docs/API.md)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/league-table` | GET | Current league standings |
| `/api/standings/history` | GET | SCD2 position history (point-in-time queries) |
| `/api/race` | GET | Cumulative points race (filterable by team/matchday) |
| `/api/form` | GET | Rolling 5-game form + momentum tiers |
| `/api/teams` | GET | Team dimension with tier classification |
| `/api/quality` | GET | Pipeline health and test results |
| `/api/live` | GET | Current live match data |
| `/api/matches` | GET | Full match history |
| `/api/results` | GET | Match results by gameweek |
| `/api/scorers` | GET | Top scorers |
| `/api/weather` | GET | Stadium weather conditions (20 venues) |
| `/api/stream` | GET (SSE) | Real-time match event streaming (speed adjustable 1-100x) |
| `/api/health` | GET | Pipeline health status |

### Cloud API (API Gateway + CloudFront)
```bash
curl https://<cloudfront-domain>/standings
curl https://<cloudfront-domain>/scorers
curl https://<cloudfront-domain>/matches
curl https://<cloudfront-domain>/health
```

### Examples (Local/Vercel)
```bash
# Get all teams currently in HOT form
curl "https://andres-alvarez-de-cloud-epl-analytics.vercel.app/api/form?momentum=HOT"

# Arsenal's position changes this season (SCD2)
curl "https://andres-alvarez-de-cloud-epl-analytics.vercel.app/api/standings/history?team=Arsenal&changes_only=true"

# Points race for the title contenders
curl "https://andres-alvarez-de-cloud-epl-analytics.vercel.app/api/race?teams=Arsenal,Manchester%20City,Chelsea"
```

---

## 🗂️ Project Structure

```
epl-pipeline-cloud/
├── Makefile                        # One-command interface (setup/run/test/demo)
├── docker-compose.yml              # Airflow + Postgres
├── requirements.txt                # Python dependencies (pinned)
├── .env.example                    # Environment template
├── .github/workflows/ci.yml        # CI: lint → dbt test → dashboard build
│
├── scripts/                        # Python ingestion + quality + exports
│   ├── ingest_live_matches.py      # Live API → DuckDB (with contract validation)
│   ├── ingest_live_standings.py    # Live standings → DuckDB
│   ├── backfill_season.py          # Full season backfill (idempotent)
│   ├── contracts.py                # Schema contract validation framework
│   ├── validate_live_payloads.py   # Pre-transform validation
│   ├── check_live_freshness.py     # Freshness monitoring
│   ├── is_matchday.py              # Matchday-aware scheduling check
│   ├── export_live_json.py         # Gold → dashboard JSON
│   ├── export_quality.py           # Quality metrics → JSON
│   ├── export_weather_json.py      # Weather Gold → dashboard JSON
│   ├── export_stream_events.py     # StatsBomb events → SSE replay JSON
│   ├── ingest_weather.py           # Open-Meteo API → 20 stadiums
│   ├── stadium_coordinates.json    # All 20 EPL stadium lat/lon
│   ├── setup_aws.sh                # Bootstrap AWS (state bucket + DynamoDB)
│   ├── deploy_lambdas.sh           # Package & deploy Lambda functions
│   └── live_common.py              # Shared utilities
│
├── dbt/                            # SQL transformations (dbt-duckdb / dbt-athena)
│   ├── models/
│   │   ├── staging/                # 🥈 Silver layer (6 views)
│   │   │   ├── stg_matches.sql
│   │   │   ├── stg_standings.sql
│   │   │   ├── stg_top_scorers.sql
│   │   │   ├── stg_live_matches.sql
│   │   │   ├── stg_live_standings.sql
│   │   │   ├── stg_stadium_weather.sql
│   │   │   └── schema.yml          # 7 sources, 6 models documented
│   │   └── mart/                   # 🥇 Gold layer (11 tables + 1 incremental)
│   │       ├── mart_league_table.sql
│   │       ├── mart_live_league_table.sql
│   │       ├── mart_live_matches.sql
│   │       ├── mart_recent_results.sql     # Incremental
│   │       ├── mart_top_scorers.sql
│   │       ├── mart_scd1_matches.sql       # SCD Type 1
│   │       ├── mart_scd2_standings.sql     # SCD Type 2
│   │       ├── mart_points_race.sql
│   │       ├── mart_rolling_form.sql
│   │       ├── mart_stadium_weather.sql
│   │       ├── dim_teams.sql
│   │       ├── dim_matchdays.sql
│   │       └── schema.yml          # All models + columns documented
│   ├── macros/
│   │   ├── safe_divide.sql         # Portable division (BigQuery ↔ DuckDB)
│   │   └── generate_schema_name.sql
│   ├── dbt_project.yml
│   └── profiles.yml                # Local (DuckDB) + Cloud (Athena) targets
│
├── dags/                           # Airflow orchestration (6 active DAGs)
│   ├── live_poll_15m.py            # ⚡ 15-min + matchday-aware ShortCircuit
│   ├── hourly_refresh.py           # 🔄 Hourly pipeline
│   ├── dbt_transform.py            # 🔧 30-min dbt runs
│   ├── daily_reconcile.py          # 🌙 2 AM full rebuild
│   ├── ingest_epl_local.py         # 📥 6 AM StatsBomb refresh
│   └── weather_ingest.py           # 🌤️ 30-min stadium weather
│
├── lambda/                         # AWS Lambda functions
│   ├── daily_ingest/               # StatsBomb → S3
│   ├── live_matches/               # football-data.org → S3
│   ├── backfill/                   # Season backfill → S3
│   ├── data_quality/               # Validation checks
│   └── api/                        # REST API (S3 → JSON)
│
├── infra/                          # Infrastructure as Code
│   └── terraform/                  # 14 files, 1,762 lines, 62 resources
│       ├── main.tf                 # S3 data lake, ECS, ECR, static dashboard
│       ├── lambda.tf               # 5 Lambda functions + layers
│       ├── api_gateway.tf          # REST API endpoints
│       ├── cloudfront.tf           # CDN distribution
│       ├── eventbridge.tf          # Scheduling rules
│       ├── monitoring.tf           # CloudWatch + SNS + alarms
│       ├── iam.tf                  # Roles (Lambda, SFN, OIDC)
│       ├── glue.tf                 # Data catalog
│       ├── athena.tf               # Query workgroup
│       └── outputs.tf              # Exported URLs & ARNs
│
├── dashboard/                      # Next.js 14 + TypeScript + Tailwind
│   ├── app/                        # 12 pages (App Router)
│   │   ├── page.tsx                # League table
│   │   ├── race/page.tsx           # Points race chart
│   │   ├── form/page.tsx           # Momentum + SCD2 tracker
│   │   ├── live/page.tsx           # Live matches
│   │   ├── results/page.tsx        # Match results
│   │   ├── scorers/page.tsx        # Top scorers
│   │   ├── stats/page.tsx          # Team comparisons (radar)
│   │   ├── stream/page.tsx         # SSE match replay
│   │   ├── weather/page.tsx        # Stadium weather
│   │   ├── quality/page.tsx        # Data quality dashboard
│   │   ├── lineage/page.tsx        # dbt docs embed
│   │   ├── health/page.tsx         # AWS resource status + pipeline health
│   │   └── api/                    # 12 REST API routes (incl. SSE, health)
│   ├── components/                 # Navigation, TeamBadge, DataSourceBadges, etc.
│   └── lib/                        # Data fetching + types
│
├── data/
│   └── epl_pipeline.duckdb         # Local OLAP warehouse
│
├── tests/                          # Python unit tests (pytest)
│
└── docs/
    ├── AWS_ARCHITECTURE.md         # Full cloud architecture + Mermaid diagram
    ├── API.md                      # REST API reference
    ├── SECURITY.md                 # Security posture (OIDC, IAM, encryption)
    ├── MVP_BUILD_SUMMARY.md        # Original build notes
    ├── live-pipeline-spec.md       # Live pipeline specification
    ├── architecture.mmd            # Mermaid source
    └── architecture.png            # Rendered architecture diagram
```

---

## 🧪 Data Quality

### dbt Tests (37 assertions)
- **Uniqueness**: All primary keys (match_id, team_name, player_id)
- **Not-null**: Critical fields across all layers
- **Source freshness**: 1h warn / 4h error SLAs on live tables

### Schema Contracts (`scripts/contracts.py`)
- Pre-ingestion validation of API responses
- Required fields, type checks, enum validation, range checks, nested field validation
- 10% failure threshold blocks entire batch from entering Bronze

### Quality Dashboard ([`/quality`](https://andres-alvarez-de-cloud-epl-analytics.vercel.app/quality))
- Real-time test pass rates
- Data freshness with SLA indicators
- Table inventory across Bronze/Silver/Gold
- Individual test execution times

---

## 🏛️ Data Governance

Production data platforms aren't just about moving data — they need **discoverability, documentation, lineage, and quality enforcement**. This project implements all four:

### Data Catalog & Documentation
- **150+ columns fully documented** in dbt `schema.yml` files with human-readable descriptions
- **18 models documented** with business context: what they represent, how they're derived, and who consumes them
- **7 sources declared** with explicit `loaded_at_field` references for freshness tracking
- **dbt docs site** auto-generated and served at [`/dbt-docs/index.html`](https://andres-alvarez-de-cloud-epl-analytics.vercel.app/dbt-docs/index.html) — full searchable catalog with column-level descriptions, tests, and relationships
- **AWS Glue Catalog** provides schema-on-read metadata for the cloud layer (Athena queries)

### Data Lineage
- **Native lineage visualization** at [`/lineage`](https://andres-alvarez-de-cloud-epl-analytics.vercel.app/lineage) — interactive DAG built with `@xyflow/react` + dagre auto-layout
- **27 nodes, 16 edges** mapping the full dependency graph: 9 raw sources → 6 staging models → 2 dimensions → 12 mart models
- **Color-coded by medallion layer**: Bronze (green), Silver (blue), Gold (purple), Dimension (amber), Seed (gray)
- **dbt manifest-driven** — lineage.json is generated directly from dbt's `manifest.json`, so the graph always reflects the actual SQL dependency tree
- **dbt docs explorer** linked from the lineage page for deep-dive column-level lineage and test coverage per node

### Quality Enforcement
- **37 dbt tests** (uniqueness, not-null, accepted values, relationships) run every 30 minutes via the `dbt_transform` DAG
- **Source freshness SLAs**: 1-hour warn / 4-hour error thresholds on all live tables — stale data gets flagged before it reaches Gold
- **Schema contracts** (`contracts.py`) validate API responses at ingestion time — malformed batches are rejected before entering Bronze
- **10% failure threshold** on contract validation blocks entire ingestion batch, preventing partial/corrupt data from propagating
- **Quality dashboard** at [`/quality`](https://andres-alvarez-de-cloud-epl-analytics.vercel.app/quality) exposes test pass rates, freshness SLAs, and medallion inventory in real-time

### Why This Matters
In enterprise data platforms, **data trust** is the #1 challenge. This project demonstrates the same governance patterns used at scale:
- **Discoverability** → Can a new team member find and understand any table? ✅ (dbt docs + catalog)
- **Lineage** → If a source breaks, what downstream dashboards are affected? ✅ (DAG visualization)
- **Quality** → How do we know the data is correct and fresh? ✅ (tests + freshness SLAs + contracts)
- **Auditability** → Can we trace any Gold metric back to its raw source? ✅ (SCD2 history + Bronze audit trail)

---

## 📈 Data Pipeline Details

### Medallion Architecture

| Layer | Schema | Count | Materialization | Purpose |
|-------|--------|-------|-----------------|---------|
| 🥉 **Bronze** | `raw` | 7 tables | Append-only | Raw API responses — full audit trail |
| 🥈 **Silver** | `staging` | 6 views | Virtual (zero storage) | Dedup, normalize, derive metrics |
| 🥇 **Gold** | `mart` | 12 tables (11 + 1 incremental) | Full refresh / incremental | Business-ready data for dashboard + APIs |

### Data Warehouse Patterns

| Pattern | Model | What It Demonstrates |
|---------|-------|---------------------|
| **SCD Type 2** | `mart_scd2_standings` | Pure versioned history — collapses unchanged positions into single rows (~330 vs 760 rows) |
| **SCD Type 1** | `mart_scd1_matches` | Upsert with correction tracking — first_seen, last_updated, update_count |
| **Kimball Dimensions** | `dim_teams`, `dim_matchdays` | Star schema with tier classification and schedule awareness |
| **Rolling Windows** | `mart_rolling_form` | 5-game rolling PPG, momentum tiers (HOT/STEADY/COOLING/COLD) |
| **Accumulating Snapshot** | `mart_points_race` | Running totals for season-long visualization |
| **Incremental** | `mart_recent_results` | Append-only processing — only new matches per run |
| **View-based Staging** | All `stg_*` models | Zero-cost transforms that always reflect latest Bronze data |
| **Schema Contracts** | `contracts.py` | Pre-validation firewall at the ingestion boundary |
| **Matchday-Aware Scheduling** | `is_matchday.py` + DAG | Resource optimization — skip polling when no matches |

### Data Sources

| Source | Data | Frequency | Airflow DAG | Records |
|--------|------|-----------|-------------|---------|
| football-data.org | Live scores, standings (2025-26) | Every 15 min (matchday-aware) | `live_poll_15m` | 380 matches, 20 teams |
| football-data.org | Standings, scorers | Hourly | `hourly_refresh` | 20 teams, 50+ scorers |
| StatsBomb Open Data | Historical match events | Daily at 6 AM | `ingest_epl_local` | 129K+ events |
| Open-Meteo | Stadium weather (20 venues) | Every 5 min | `weather_ingest` | 20 stadiums, real-time |
| TheSportsDB | Fallback scores | On API failure | — | Auto-failover |
| — | dbt transforms (all Gold models) | Every 30 min | `dbt_transform` | 18 models, 37 tests |
| — | Full reconciliation rebuild | Daily at 2 AM | `daily_reconcile` | All layers |

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Ingestion** | Python 3.13, requests | API extraction with contract validation |
| **Local Storage** | DuckDB 1.1 | Embedded OLAP database (zero-config, columnar) |
| **Cloud Storage** | S3 (Parquet) | Versioned, encrypted data lake |
| **Transform** | dbt-core 1.8 + dbt-duckdb | SQL transforms, testing, documentation |
| **Local Orchestration** | Apache Airflow 2.9 (Docker) | 6 DAGs with matchday-aware scheduling |
| **Cloud Orchestration** | Step Functions + EventBridge | Serverless daily pipeline |
| **Cloud Compute** | AWS Lambda (x5) | Serverless ingestion & API |
| **Cloud Query** | Athena + Glue Catalog | Serverless SQL on S3 |
| **Dashboard** | Next.js 14, TypeScript, Tailwind CSS | 12-page data application |
| **Dashboard Hosting** | Vercel (free tier) | Auto-deploy from `main`, zero-config |
| **Charts** | Recharts | Line charts, bar charts, radar charts |
| **API** | Next.js API Routes + API Gateway | 12 local + 4 cloud REST endpoints |
| **CDN** | CloudFront | HTTPS, caching, custom-domain ready |
| **Monitoring** | CloudWatch + SNS | Dashboard, alarms, notifications |
| **CI/CD** | GitHub Actions (OIDC) | Lint → dbt build → dashboard build (no static keys) |
| **IaC** | Terraform | 62 AWS resources, 14 files |
| **Containers** | Docker Compose | Airflow + Postgres backend |

---

## 💰 Cost

| Component | Cost |
|-----------|------|
| DuckDB | Free (embedded) |
| football-data.org API | Free tier (10 req/min) |
| StatsBomb Open Data | Free (open source) |
| Open-Meteo | Free (no key required) |
| Airflow (Docker) | Free (local) |
| Vercel Dashboard | Free (hobby tier) |
| GitHub Actions CI | Free (public repo) |
| **Local Total** | **$0/month** |
| AWS Cloud Layer | ~$2–5/month (dev) |
| **Cloud Total** | **~$2–5/month** |

See [docs/AWS_ARCHITECTURE.md](docs/AWS_ARCHITECTURE.md) for full AWS cost breakdown.

---

## 🗺️ Roadmap

- [x] Medallion architecture (Bronze → Silver → Gold)
- [x] 6 Airflow DAGs with matchday-aware scheduling
- [x] 18 dbt models with 37 tests
- [x] Full 2025-26 season backfill (380 matches)
- [x] SCD Type 1 + Type 2 position tracking
- [x] Rolling form + momentum classification
- [x] Kimball dimensions (teams, matchdays)
- [x] Schema contract validation
- [x] 12-page Next.js dashboard
- [x] 12 REST API endpoints (including SSE streaming)
- [x] SSE match replay — real-time event streaming (producer → consumer pattern)
- [x] Stadium weather pipeline (Open-Meteo → 20 EPL venues)
- [x] Data quality dashboard + lineage visualization
- [x] Pipeline health page with AWS resource inventory
- [x] CI/CD with GitHub Actions (OIDC — no static keys)
- [x] AWS cloud layer — S3, Lambda, Step Functions, EventBridge, API Gateway, CloudFront, Athena, Glue
- [x] Terraform IaC (62 resources, 1,762 lines)
- [x] CloudWatch monitoring + 4 alarms + 2 SNS topics
- [x] Vercel deployment (live dashboard, auto-deploy from `main`)
- [x] Data warehouse pattern badges (SCD, Kimball, Accumulating Snapshot, etc.)
- [x] One-command setup (Makefile)
- [x] 150+ columns fully documented

---

## 📄 Documentation

| Document | Description |
|----------|-------------|
| [AWS Architecture](docs/AWS_ARCHITECTURE.md) | Full cloud architecture, Mermaid diagram, resource inventory, cost estimate |
| [API Reference](docs/API.md) | All REST endpoints with examples and response schemas |
| [Security](docs/SECURITY.md) | OIDC auth, IAM roles, encryption, network security |
| [Live Pipeline Spec](docs/live-pipeline-spec.md) | Airflow DAG specifications and scheduling logic |
| [MVP Build Summary](docs/MVP_BUILD_SUMMARY.md) | Original build notes and design decisions |

---

## 📝 License

[MIT](LICENSE)

---

*Built by [Andres Alvarez](https://github.com/StarLord598) — Data Engineering Portfolio Project*
*Pipeline automation by [Rocket 🦝](https://github.com/rocket-racoon-tech-bot)*
