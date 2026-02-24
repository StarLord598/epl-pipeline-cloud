# AWS Cloud Architecture — EPL Pipeline

## Overview

The cloud layer extends the existing local DuckDB + Airflow pipeline to run on AWS, using a serverless architecture with S3 data lake, Lambda for ingestion, Glue Catalog for metadata, and Athena for querying.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Data Sources"
        SB[StatsBomb Open Data]
        FD[football-data.org API]
        TS[TheSportsDB Fallback]
    end

    subgraph "Ingestion Layer — AWS Lambda"
        L1[daily_ingest<br/>StatsBomb → S3]
        L2[live_matches<br/>football-data.org → S3]
        L3[backfill<br/>Season Backfill → S3]
    end

    subgraph "Orchestration"
        EB1[EventBridge<br/>Daily 6AM UTC]
        EB2[EventBridge<br/>Every 15min]
        EB3[EventBridge<br/>Weekly Monday]
    end

    subgraph "Storage — S3 Data Lake"
        RAW[raw/<br/>matches, events,<br/>lineups, live_matches]
        STG[staging/<br/>cleaned & deduped]
        MART[mart/<br/>league_table,<br/>top_scorers, etc.]
    end

    subgraph "Catalog & Query"
        GC[AWS Glue Catalog]
        ATH[Amazon Athena]
        DBT[dbt cloud target<br/>dbt-athena-community]
    end

    subgraph "Secrets & Auth"
        SM[Secrets Manager<br/>API Keys]
        IAM[IAM Roles<br/>Lambda, GitHub OIDC]
    end

    subgraph "CI/CD"
        GHA[GitHub Actions<br/>OIDC Auth]
        TF[Terraform IaC]
    end

    subgraph "Existing Local Stack"
        DDB[(DuckDB)]
        AF[Airflow]
        DASH[Next.js Dashboard]
    end

    SB --> L1
    FD --> L2
    TS -.->|fallback| L2
    FD --> L3

    EB1 --> L1
    EB2 --> L2
    EB3 --> L3

    L1 --> RAW
    L2 --> RAW
    L3 --> RAW

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

    GHA --> TF
    GHA -->|deploy| L1
    GHA -->|deploy| L2
    GHA -->|deploy| L3

    style RAW fill:#ff6b6b,color:#fff
    style STG fill:#ffd93d,color:#333
    style MART fill:#6bcb77,color:#fff
    style DDB fill:#4d96ff,color:#fff
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
| `daily_ingest` | Daily 6 AM UTC | StatsBomb | Full match, event, lineup ingestion |
| `live_matches` | Every 15 min | football-data.org | Live/recent match scores |
| `backfill` | Weekly Monday | football-data.org | Full season backfill |

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
| 3 Lambda Functions | Lambda | Serverless ingestion |
| 3 EventBridge Rules | EventBridge | Scheduled triggers |
| API Keys Secret | Secrets Manager | football-data.org key |
| Lambda Exec Role | IAM | Least-privilege execution |
| GitHub OIDC Role | IAM | CI/CD without static keys |

## Local vs Cloud

The cloud layer is **additive** — the existing local pipeline continues to work unchanged:

| Capability | Local | Cloud |
|-----------|-------|-------|
| Storage | DuckDB | S3 + Parquet |
| Orchestration | Airflow | EventBridge |
| Ingestion | Python scripts | Lambda functions |
| Query Engine | DuckDB | Athena |
| dbt Target | `local` (DuckDB) | `cloud` (Athena) |
| Dashboard | Next.js (JSON files) | Next.js (JSON files) |

## Cost Estimate (Dev)

| Service | Monthly Estimate |
|---------|-----------------|
| Lambda | ~$0.50 (low invocations) |
| S3 | ~$0.50 (< 1 GB) |
| Athena | ~$0.25 (minimal queries) |
| Secrets Manager | $0.40 |
| EventBridge | Free tier |
| **Total** | **~$1.65/mo** |

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
```
