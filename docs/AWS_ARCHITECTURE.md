# AWS Cloud Architecture — EPL Pipeline

## Overview

The cloud layer extends the existing local DuckDB + Airflow pipeline to run on AWS, using a serverless architecture with S3 data lake, Lambda for ingestion, Glue Catalog for metadata, Athena for querying, Step Functions for orchestration, API Gateway + CloudFront for public API access, and CloudWatch for monitoring.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Data Sources"
        SB[StatsBomb Open Data]
        FD[football-data.org API]
        TS[TheSportsDB Fallback]
    end

    subgraph "Orchestration — Step Functions"
        SFN[Step Functions<br/>Daily Pipeline]
        EB_SFN[EventBridge<br/>Daily 6AM UTC]
        EB2[EventBridge<br/>Every 15min]
        EB3[EventBridge<br/>Weekly Monday]
    end

    subgraph "Ingestion Layer — AWS Lambda"
        L1[daily_ingest<br/>StatsBomb → S3]
        L2[live_matches<br/>football-data.org → S3]
        L3[backfill<br/>Season Backfill → S3]
        L4[data_quality<br/>Validation Checks]
        L5[api<br/>REST Endpoints]
    end

    subgraph "Storage — S3 Data Lake"
        RAW[raw/<br/>matches, events,<br/>lineups, live_matches]
        STG[staging/<br/>cleaned & deduped]
        MART[mart/<br/>league_table,<br/>top_scorers, etc.]
    end

    subgraph "Public API Layer"
        CF[CloudFront CDN<br/>HTTPS + Caching]
        APIGW[API Gateway<br/>/standings /scorers<br/>/matches /health]
    end

    subgraph "Monitoring & Alerts"
        CW[CloudWatch Dashboard<br/>Invocations, Errors,<br/>Duration, S3 Size]
        SNS_A[SNS Alerts<br/>Error Notifications]
        SNS_N[SNS Notifications<br/>Pipeline Status]
        ALARMS[CloudWatch Alarms<br/>Lambda Errors,<br/>SFN Failures]
    end

    subgraph "Catalog & Query"
        GC[AWS Glue Catalog]
        ATH[Amazon Athena]
        DBT[dbt cloud target<br/>dbt-athena-community]
    end

    subgraph "Secrets & Auth"
        SM[Secrets Manager<br/>API Keys]
        IAM[IAM Roles<br/>Lambda, SFN,<br/>GitHub OIDC]
    end

    subgraph "CI/CD"
        GHA[GitHub Actions<br/>OIDC Auth]
        TF[Terraform IaC]
    end

    SB --> L1
    FD --> L2
    TS -.->|fallback| L2
    FD --> L3

    EB_SFN --> SFN
    SFN -->|Step 1| L1
    SFN -->|Step 2| L4
    SFN -->|Step 3| SNS_N

    EB2 --> L2
    EB3 --> L3

    L1 --> RAW
    L2 --> RAW
    L3 --> RAW
    L4 -->|reads| STG
    L4 -->|reads| RAW

    SM --> L1
    SM --> L2
    SM --> L3

    RAW --> DBT
    DBT --> STG
    DBT --> MART

    GC --> ATH
    RAW --> GC
    STG --> GC
    MART --> GC

    CF --> APIGW
    APIGW --> L5
    L5 -->|reads| STG
    L5 -->|reads| RAW

    L1 --> CW
    L2 --> CW
    L3 --> CW
    SFN --> CW
    ALARMS --> SNS_A

    GHA --> TF
    GHA -->|deploy| L1
    GHA -->|deploy| L2
    GHA -->|deploy| L3

    style RAW fill:#ff6b6b,color:#fff
    style STG fill:#ffd93d,color:#333
    style MART fill:#6bcb77,color:#fff
    style CF fill:#9b59b6,color:#fff
    style SFN fill:#3498db,color:#fff
    style CW fill:#e67e22,color:#fff
```

## Data Flow

### Medallion Architecture on S3

| Layer | S3 Prefix | Format | Description |
|-------|-----------|--------|-------------|
| **Raw** | `raw/` | Parquet | Immutable source data as ingested |
| **Staging** | `staging/` | Parquet | Cleaned, deduplicated, typed |
| **Mart** | `mart/` | Parquet | Business-ready aggregations |

### Lambda Functions

| Function | Trigger | Source | Description |
|----------|---------|--------|-------------|
| `daily_ingest` | Step Functions | StatsBomb | Full match, event, lineup ingestion |
| `live_matches` | Every 15 min (EventBridge) | football-data.org | Live/recent match scores |
| `backfill` | Weekly Monday (EventBridge) | football-data.org | Full season backfill |
| `data_quality` | Step Functions | S3 | Validates row counts, schema, nulls |
| `api` | API Gateway | S3 | Serves standings, scorers, matches, health |

### Step Functions Pipeline

The daily pipeline is orchestrated by Step Functions instead of direct EventBridge→Lambda:

1. **Daily Ingest** — Fetches matches, standings, and scorers from APIs → S3
2. **Data Quality Check** — Validates latest S3 objects (non-empty, valid JSON, expected keys)
3. **SNS Notification** — Sends success/failure notification with details

Includes retry logic (2 retries with exponential backoff) and error catching at each step.

### Public API (API Gateway + CloudFront)

| Endpoint | Description | Cache TTL |
|----------|-------------|-----------|
| `GET /standings` | Latest league standings from S3 | 5 min |
| `GET /scorers` | Top scorers from S3 | 5 min |
| `GET /matches` | Latest match data from S3 | 5 min |
| `GET /health` | Pipeline health + last run status | 1 min |

CloudFront provides HTTPS, caching, and is custom-domain-ready (add ACM cert).

### Monitoring & Alerts

| Component | Metrics |
|-----------|---------|
| **Dashboard** | Lambda invocations, errors, duration (avg/p99), S3 size, SFN status |
| **Alarms** | Lambda errors > 0, Step Function failures |
| **SNS Topics** | Pipeline notifications (success/fail), Alert notifications |

### Partitioning Strategy

- `raw/live_matches/` — Partitioned by `ingestion_date` (Hive-style: `ingestion_date=YYYY-MM-DD/`)
- `raw/matches/` — Partitioned by `season_id`
- `raw/events/` — Append-only with timestamp in filename

## AWS Resources

| Resource | Service | Purpose |
|----------|---------|---------|
| Data Lake Bucket | S3 | Parquet storage (versioned, encrypted) |
| Athena Results Bucket | S3 | Query result cache (7-day expiry) |
| Lambda Deploy Bucket | S3 | Function deployment packages |
| EPL Database | Glue Catalog | Schema-on-read metadata |
| EPL Workgroup | Athena | Query engine with cost controls |
| 5 Lambda Functions | Lambda | Ingestion, quality checks, API |
| Daily Pipeline | Step Functions | Orchestrated ingest + validation |
| 3 EventBridge Rules | EventBridge | SFN schedule, live matches, backfill |
| REST API | API Gateway | Public data endpoints |
| CDN Distribution | CloudFront | HTTPS, caching, custom domain ready |
| Pipeline Dashboard | CloudWatch | Operational visibility |
| 4 Alarms | CloudWatch | Error & failure detection |
| 2 SNS Topics | SNS | Alerts + pipeline notifications |
| API Keys Secret | Secrets Manager | football-data.org key |
| Lambda Exec Role | IAM | Least-privilege execution |
| SFN Exec Role | IAM | Step Functions permissions |
| EventBridge SFN Role | IAM | EventBridge→SFN trigger |
| GitHub OIDC Role | IAM | CI/CD without static keys |

## Local vs Cloud

The cloud layer is **additive** — the existing local pipeline continues to work unchanged:

| Capability | Local | Cloud |
|-----------|-------|-------|
| Storage | DuckDB | S3 + Parquet |
| Orchestration | Airflow | Step Functions + EventBridge |
| Ingestion | Python scripts | Lambda functions |
| Query Engine | DuckDB | Athena |
| dbt Target | `local` (DuckDB) | `cloud` (Athena) |
| Dashboard | Next.js (JSON files) | Next.js (JSON files) |
| Public API | Flask/FastAPI (local) | API Gateway + CloudFront |
| Monitoring | — | CloudWatch Dashboard + Alarms |

## Cost Estimate (Dev)

| Service | Monthly Estimate |
|---------|-----------------|
| Lambda (5 functions) | ~$0.75 (low invocations) |
| S3 | ~$0.50 (< 1 GB) |
| Athena | ~$0.25 (minimal queries) |
| Secrets Manager | $0.40 |
| Step Functions | ~$0.10 (free tier: 4,000 transitions/mo) |
| API Gateway | ~$0.10 (free tier: 1M calls/mo) |
| CloudFront | ~$0.10 (free tier: 1 TB/mo) |
| CloudWatch | ~$0.00 (free tier: 10 alarms, 3 dashboards) |
| SNS | ~$0.00 (free tier: 1M publishes) |
| EventBridge | Free tier |
| **Total** | **~$2.20/mo** |

## Setup

```bash
# 1. Bootstrap AWS (state bucket, DynamoDB lock table)
./scripts/setup_aws.sh

# 2. Deploy infrastructure
cd infra/terraform
terraform plan
terraform apply

# 3. Set API key
aws secretsmanager put-secret-value \
  --secret-id epl-pipeline/dev/api-keys \
  --secret-string '{"FOOTBALL_DATA_API_KEY":"your-key"}'

# 4. Deploy Lambda code
./scripts/deploy_lambdas.sh

# 5. Run dbt against cloud
cd dbt && dbt run --target cloud

# 6. Access the public API
terraform output cloudfront_url
# → https://d1234567890.cloudfront.net/standings
```
