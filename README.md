# ⚽ EPL Cloud Analytics Platform

> **A serverless cloud data platform on AWS** that ingests, stores, queries, and serves Premier League data — orchestrated by Step Functions, ingested by Lambda, stored in S3 (Parquet), queried via Athena, and served through a Next.js dashboard on Vercel with a CloudFront-backed REST API.

> 📌 **Looking for the local pipeline?** See [epl-pipeline-de-project](https://github.com/StarLord598/epl-pipeline-de-project) — the DuckDB + Airflow + dbt local stack that this cloud platform extends.

🔗 **[Live Dashboard →](https://andres-alvarez-de-cloud-epl-analytics.vercel.app)**

![AWS](https://img.shields.io/badge/cloud-AWS-FF9900?logo=amazonaws)
![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform)
![Vercel](https://img.shields.io/badge/dashboard-Vercel-000?logo=vercel)
[![CI — EPL Pipeline](https://github.com/StarLord598/epl-pipeline-cloud/actions/workflows/ci.yml/badge.svg)](https://github.com/StarLord598/epl-pipeline-cloud/actions)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│       football-data.org ─────── StatsBomb Open Data                 │
│       (live scores, standings,   (historical match events)          │
│        scorers, fixtures)                                           │
└──────────┬────────────────────────────────┬─────────────────────────┘
           │                                │
           ▼                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  ⚡ AWS ORCHESTRATION                                 │
│                                                                      │
│  EventBridge ──► Step Functions (Daily Pipeline)                     │
│   ├── Daily 6 AM UTC ──► SFN: Ingest → Quality Check → SNS Notify  │
│   ├── Every 15 min ────► Lambda: live_matches                       │
│   └── Weekly Monday ───► Lambda: backfill                           │
└──────────────────────────────────────────┬───────────────────────────┘
                                           │
           ┌───────────────────────────────┼───────────────────────┐
           ▼                               ▼                       ▼
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  λ daily_ingest    │  │  λ live_matches    │  │  λ backfill        │
│  StatsBomb → S3    │  │  football-data →S3 │  │  Season backfill   │
└─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
          │                       │                        │
          ▼                       ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    🪣 S3 DATA LAKE (Parquet)                         │
│                                                                      │
│  raw/matches/          ── daily match data (full season)             │
│  raw/live_matches/     ── live scores, every 15 min (date-partitioned)│
│  raw/standings/        ── league table snapshots                     │
│  raw/top_scorers/      ── scorer rankings                            │
│  raw/events/           ── StatsBomb historical events                │
│                                                                      │
│  Versioned · Server-side encrypted (AES-256) · Lifecycle policies   │
└──────────┬───────────────────────┬───────────────────────────────────┘
           │                       │
           ▼                       ▼
┌────────────────────┐  ┌──────────────────────────────────────────────┐
│  λ data_quality    │  │  Glue Catalog + Athena                       │
│  Validates S3 data │  │  Schema-on-read · Serverless SQL on S3      │
│  → SNS alerts      │  │  Cost-controlled workgroup                   │
└────────────────────┘  └──────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    🌍 API LAMBDA (live merge)                        │
│                                                                      │
│  /standings  → latest from raw/standings/                            │
│  /scorers   → latest from raw/top_scorers/                          │
│  /matches   → raw/matches/ + raw/live_matches/ (merged by match ID) │
│  /health    → pipeline health + last run status                      │
│                                                                      │
│  Live merge: overlays real-time scores from live_matches/ on top of │
│  daily data — dashboard always shows in-progress match scores       │
└──────────────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    🔒 API Gateway + CloudFront CDN                   │
│                                                                      │
│  HTTPS · CORS · 5-min cache · Custom-domain ready                   │
└──────────────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    🖥️ DASHBOARD (Next.js 14 + Vercel)                │
│                                                                      │
│  12 pages: Table · Race · Form · Live · Results · Scorers · Stats   │
│           Stream · Weather · Quality · Lineage · Health              │
│                                                                      │
│  ⚡ Live pages → CloudFront API (primary) + static JSON (fallback)   │
│  📊 Race & Form → derived client-side from /matches API             │
│  📁 Static pages (Quality, Stream, Lineage, Weather) → batch JSON   │
│                                                                      │
│  🔗 andres-alvarez-de-cloud-epl-analytics.vercel.app                │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    📡 MONITORING & ALERTS                            │
│                                                                      │
│  CloudWatch Dashboard · 4 Alarms · 2 SNS Topics                    │
│  Lambda metrics (invocations, errors, duration, p99)                │
│  Step Function execution tracking · S3 storage metrics              │
└──────────────────────────────────────────────────────────────────────┘
```

For the detailed Mermaid diagram, see [docs/AWS_ARCHITECTURE.md](docs/AWS_ARCHITECTURE.md).

---

## ✨ Key Features

### Cloud Infrastructure
| Component | Service | Purpose |
|-----------|---------|---------|
| **Data Lake** | S3 (Parquet, versioned, encrypted) | Medallion-style storage: raw/ partitioned by source |
| **Ingestion** | Lambda (x5) | daily_ingest, live_matches, backfill, data_quality, api |
| **Orchestration** | Step Functions + EventBridge | Daily pipeline: Ingest → Quality Check → SNS Notify |
| **Live Scores** | Lambda (every 15 min) + API merge | Real-time match scores overlaid on daily data |
| **Public API** | API Gateway + CloudFront | REST endpoints with CDN caching (5-min TTL) |
| **Dashboard** | Vercel (free tier) | Auto-deploy from `main`, 12-page Next.js app |
| **Query Engine** | Athena + Glue Catalog | Serverless SQL on S3 with schema-on-read |
| **Monitoring** | CloudWatch + SNS | Dashboard, 4 alarms, 2 notification topics |
| **Secrets** | Secrets Manager | Encrypted API key storage (auto-rotated) |
| **IaC** | Terraform (14 files, 1,762 lines) | All 62 AWS resources as code |
| **CI/CD** | GitHub Actions + OIDC | Federated identity — no static AWS keys |

### Data Pipeline Patterns
| Pattern | Implementation |
|---------|---------------|
| **Live Score Merge** | API Lambda overlays `raw/live_matches/` (15-min poll) on daily data — dashboard shows in-progress scores |
| **Date-Partitioned Ingestion** | Live matches stored as `raw/live_matches/YYYY-MM-DD/*.json` for efficient S3 listing |
| **Step Function Orchestration** | Daily pipeline: Ingest → Quality Check → SNS Notify (with retry + error catching) |
| **Serverless Query** | Athena + Glue Catalog for ad-hoc SQL on the S3 data lake |
| **CDN-Backed API** | CloudFront caches API responses (5-min TTL) for low-latency global access |
| **Schema Contracts** | Lambda validates API responses before writing to S3 — bad batches rejected |
| **OIDC CI/CD** | GitHub Actions assumes AWS role via OIDC — no static credentials stored anywhere |
| **Infrastructure as Code** | 62 AWS resources defined in 14 Terraform files |

### Platform Stats
| Metric | Count |
|--------|-------|
| AWS Resources | 62 (all Terraform-managed) |
| Lambda Functions | 5 |
| CloudWatch Alarms | 4 |
| SNS Topics | 2 |
| Terraform Lines | 1,762 across 14 files |
| Dashboard Pages | 12 (interactive charts, live scores, weather, quality, lineage, health) |
| API Endpoints (Cloud) | 4 (standings, scorers, matches, health) |
| API Endpoints (Dashboard) | 12 (including SSE streaming) |

---

## 🚀 Quick Start

### Live Dashboard (no setup required)

**[→ andres-alvarez-de-cloud-epl-analytics.vercel.app](https://andres-alvarez-de-cloud-epl-analytics.vercel.app)**

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

# 5. Get your public API URL
terraform output cloudfront_url
```

### Dashboard Development

```bash
cd dashboard && npm ci && npm run dev     # → http://localhost:3000
```

### Environment Variables
```bash
cp .env.example .env
# Required: FOOTBALL_DATA_API_KEY (free at https://www.football-data.org/client/register)
```

---

## 📡 Cloud API (API Gateway + CloudFront)

The cloud API serves live data from S3 through API Gateway + CloudFront (5-min cache). The `/matches` endpoint performs a **live merge** — overlaying real-time scores from `raw/live_matches/` (updated every 15 min by Lambda) on top of the daily match data, so the dashboard always reflects in-progress scores during live matches.

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/standings` | GET | Current league standings | 5 min |
| `/scorers` | GET | Top scorers | 5 min |
| `/matches` | GET | All matches with **live score merge** | 5 min |
| `/health` | GET | Pipeline health + last run status | 1 min |

### Live Score Merge

```
┌─────────────────┐     ┌──────────────────────┐
│ raw/matches/     │     │ raw/live_matches/     │
│ (daily, 380      │     │ (every 15 min,        │
│  matches)        │     │  today's scores)      │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         └──────────┬──────────────┘
                    ▼
         ┌──────────────────┐
         │  API Lambda       │
         │  merge by match ID│
         │  live overwrites  │
         │  daily data       │
         └────────┬─────────┘
                  ▼
         ┌──────────────────┐
         │  CloudFront (5m)  │
         └────────┬─────────┘
                  ▼
         ┌──────────────────┐
         │  Dashboard        │
         │  (Vercel)         │
         └──────────────────┘
```

Max latency: ~20 min (15-min Lambda poll + 5-min CDN cache).

### Examples
```bash
# Current standings
curl https://dr81mm57l8sab.cloudfront.net/standings

# All matches (with live scores during matchday)
curl https://dr81mm57l8sab.cloudfront.net/matches

# Pipeline health
curl https://dr81mm57l8sab.cloudfront.net/health
```

---

## 📊 Dashboard Pages

**Live:** [andres-alvarez-de-cloud-epl-analytics.vercel.app](https://andres-alvarez-de-cloud-epl-analytics.vercel.app)

| Page | Route | Data Source | Refresh | Description |
|------|-------|------------|---------|-------------|
| 🏆 **League Table** | `/` | CloudFront `/standings` | ⚡ Every 15 min | Live standings with zones, form, per-game stats |
| 📈 **Points Race** | `/race` | Derived from `/matches` | ⚡ Every 15 min | Cumulative points chart — computed client-side from match results |
| 🔥 **Form & Momentum** | `/form` | Derived from `/matches` | ⚡ Every 15 min | Rolling 5-game PPG, HOT/COLD momentum, SCD2 position history |
| ⚡ **Live Matches** | `/live` | CloudFront `/matches` + `/standings` | ⚡ Every 15 min | Real-time scores with LIVE/HT/FT badges, auto-refresh |
| ⚽ **Fixtures & Results** | `/results` | CloudFront `/matches` | ⚡ Every 15 min | FotMob-style date-grouped fixtures — scores for finished, kickoff times for upcoming, auto-scrolls to today |
| 🎯 **Top Scorers** | `/scorers` | CloudFront `/scorers` | ⚡ Every 15 min | Golden Boot race with bar charts |
| 📊 **Stats** | `/stats` | CloudFront `/standings` | ⚡ Every 15 min | Radar charts, team comparisons |
| 📡 **Streaming Replay** | `/stream` | Static batch JSON | 📅 Daily | SSE-powered match replay (StatsBomb events) |
| 🌤️ **Stadium Weather** | `/weather` | Static + Open-Meteo | 🌀 On-demand | Weather at all 20 EPL stadiums |
| 🛡️ **Data Quality** | `/quality` | Static batch JSON | 🔄 On pipeline run | Test pass rates, freshness SLAs |
| 🔗 **Data Lineage** | `/lineage` | Static metadata | 🏗️ On build | Interactive DAG visualization |
| 🏥 **Pipeline Health** | `/health` | CloudFront `/health` | 📡 On-demand | AWS resource status + pipeline monitoring |

---

## 🗂️ Project Structure

```
epl-pipeline-cloud/
├── lambda/                         # AWS Lambda functions
│   ├── daily_ingest/handler.py     # StatsBomb → S3 (Parquet)
│   ├── live_matches/handler.py     # football-data.org → S3 (15-min poll)
│   ├── backfill/handler.py         # Season backfill → S3 (idempotent)
│   ├── data_quality/handler.py     # Validation checks on S3 data
│   └── api/handler.py              # REST API — S3 reads + live merge
│
├── infra/                          # Infrastructure as Code
│   └── terraform/                  # 14 files, 1,762 lines, 62 resources
│       ├── main.tf                 # S3 data lake, provider config
│       ├── lambda.tf               # 5 Lambda functions + layers
│       ├── step_functions.tf       # Daily pipeline orchestration
│       ├── api_gateway.tf          # REST API endpoints
│       ├── cloudfront.tf           # CDN distribution
│       ├── eventbridge.tf          # Scheduling rules (daily, 15-min, weekly)
│       ├── monitoring.tf           # CloudWatch dashboard + alarms + SNS
│       ├── iam.tf                  # IAM roles (Lambda, SFN, GitHub OIDC)
│       ├── glue.tf                 # Data catalog
│       ├── athena.tf               # Query workgroup
│       ├── variables.tf            # Input variables
│       └── outputs.tf              # Exported URLs & ARNs
│
├── dashboard/                      # Next.js 14 + TypeScript + Tailwind
│   ├── app/                        # 12 pages (App Router)
│   │   ├── page.tsx                # League table (CloudFront API)
│   │   ├── race/page.tsx           # Points race (derived from /matches)
│   │   ├── form/page.tsx           # Momentum + SCD2 (derived from /matches)
│   │   ├── live/page.tsx           # Live matches (CloudFront API)
│   │   ├── results/page.tsx        # FotMob-style fixtures (CloudFront API)
│   │   ├── scorers/page.tsx        # Top scorers (CloudFront API)
│   │   ├── stats/page.tsx          # Team comparisons (CloudFront API)
│   │   ├── stream/page.tsx         # SSE match replay (static)
│   │   ├── weather/page.tsx        # Stadium weather (static + Open-Meteo)
│   │   ├── quality/page.tsx        # Data quality (static)
│   │   ├── lineage/page.tsx        # DAG visualization (static)
│   │   └── health/page.tsx         # AWS resource health (CloudFront API)
│   ├── components/                 # Navigation, DataSourceBadge, etc.
│   └── lib/api.ts                  # Shared fetch client (CloudFront + fallback)
│
├── scripts/                        # Deployment & utility scripts
│   ├── setup_aws.sh                # Bootstrap AWS (state bucket + DynamoDB)
│   └── deploy_lambdas.sh           # Package & deploy Lambda functions
│
├── .github/workflows/              # CI/CD
│   └── ci.yml                      # GitHub Actions (OIDC, no static keys)
│
├── docs/
│   ├── AWS_ARCHITECTURE.md         # Full cloud architecture + Mermaid diagram
│   ├── API.md                      # REST API reference
│   ├── SECURITY.md                 # Security posture (OIDC, IAM, encryption)
│   ├── architecture.mmd            # Mermaid source
│   └── architecture.png            # Rendered architecture diagram
│
└── public/data/                    # Static JSON fallback files
    ├── live_standings.json
    ├── league_table.json
    ├── rolling_form.json
    └── ...
```

---

## 🔒 Security

| Layer | Implementation |
|-------|---------------|
| **Authentication** | GitHub OIDC → AWS IAM (no static keys anywhere) |
| **Encryption** | S3 server-side (AES-256), Secrets Manager for API keys |
| **Network** | CloudFront HTTPS, API Gateway with CORS |
| **IAM** | Least-privilege roles per Lambda, Step Function, GitHub Actions |
| **Secrets** | API keys in Secrets Manager (not environment variables) |
| **Branch Protection** | PRs required, review required, no admin bypass |

See [docs/SECURITY.md](docs/SECURITY.md) for full security posture.

---

## 💰 Cost

| Component | Cost |
|-----------|------|
| S3 Data Lake | ~$0.02/month (small dataset) |
| Lambda (5 functions) | ~$0.50/month (free tier covers most) |
| API Gateway | ~$0.10/month |
| CloudFront | ~$0.10/month |
| Step Functions | ~$0.01/month |
| EventBridge | Free |
| CloudWatch | ~$0.50/month |
| Athena | ~$0.05/query (on-demand) |
| Glue Catalog | Free (< 1M objects) |
| Secrets Manager | $0.40/month |
| Vercel Dashboard | Free (hobby tier) |
| GitHub Actions CI | Free (public repo) |
| **Total** | **~$2–5/month** |

---

## 🔗 Related

| Repo | Description |
|------|-------------|
| [epl-pipeline-de-project](https://github.com/StarLord598/epl-pipeline-de-project) | Local pipeline — DuckDB, Airflow, dbt, 18 models, 37 tests |
| **This repo** | Cloud platform — AWS Lambda, S3, Step Functions, CloudFront, Vercel |

The local pipeline handles transformation logic (dbt models, medallion architecture, SCD patterns). This cloud repo extends it with serverless infrastructure, a public API, and a live dashboard.

---

## 📄 Documentation

| Document | Description |
|----------|-------------|
| [AWS Architecture](docs/AWS_ARCHITECTURE.md) | Full cloud architecture, Mermaid diagram, resource inventory, cost estimate |
| [API Reference](docs/API.md) | All REST endpoints with examples and response schemas |
| [Security](docs/SECURITY.md) | OIDC auth, IAM roles, encryption, network security |

---

## 📝 License

[MIT](LICENSE)

---

*Built by [Andres Alvarez](https://github.com/StarLord598) — Cloud Data Engineering Portfolio*
*Pipeline automation by [Rocket 🦝](https://github.com/rocket-racoon-tech-bot)*
