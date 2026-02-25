# Security — EPL Pipeline Cloud

## Authentication & Authorization

| Component | Method | Details |
|-----------|--------|---------|
| **CI/CD** | GitHub OIDC | Federated identity — no long-lived AWS keys in GitHub. Role scoped to `repo:StarLord598/epl-pipeline-cloud:*` |
| **Lambda** | IAM Role | Least-privilege: S3 data lake + Glue catalog + Secrets Manager (specific ARNs only) |
| **Step Functions** | IAM Role | Can invoke Lambda + publish to SNS only |
| **API Gateway** | Public (no auth) | Portfolio demo — CORS `*`. Production would add API keys or Cognito |
| **Secrets** | AWS Secrets Manager | API keys stored encrypted, referenced by ARN |

## Data Protection

| Layer | Protection |
|-------|-----------|
| **S3 Data Lake** | AES-256 server-side encryption, versioning enabled, public access fully blocked |
| **S3 Athena Results** | Public access blocked, 7-day auto-expiry lifecycle |
| **S3 Lambda Deploy** | Public access blocked |
| **S3 Static Dashboard** | Public read (intentional — serves static HTML fallback) |
| **Secrets Manager** | Encrypted at rest (AWS KMS), IAM-scoped access |
| **CloudFront** | HTTPS enabled, origin access to API Gateway |

## Network Security

- **No VPC required** — all services are serverless/managed with IAM-based access control
- **ECS Fargate** — Security group `sg-07f0796a64b9d5e0a` allows inbound port 3000 only
- **No SSH keys** — all deployments via CI/CD or CLI
- **No static AWS credentials in code** — verified via `git-secrets` hooks + manual audit

## IAM Principles

1. **Least privilege** — Lambda roles scoped to specific S3 buckets, Glue databases, and secret ARNs
2. **No wildcard actions** on sensitive services (IAM, KMS, STS)
3. **OIDC for CI/CD** — GitHub Actions assumes role via web identity, no `AWS_ACCESS_KEY_ID` in secrets
4. **Separate roles** per service: Lambda exec, Step Functions exec, EventBridge trigger, GitHub Actions deploy

## Cost Controls

- **Athena**: Workgroup with per-query byte limits
- **S3**: Lifecycle rules transition raw data to IA after 90 days; Athena results expire after 7 days
- **Lambda**: Memory capped at 256 MB, timeout at 60s
- **ECS**: Minimal Fargate task (0.25 vCPU, 512 MB) — can be stopped when not demoing
- **No Redshift** — removed to stay within AWS Free Plan ($120 credits)

## Secrets Management

| Secret | Location | Access |
|--------|----------|--------|
| `FOOTBALL_DATA_API_KEY` | Secrets Manager (`epl-pipeline/dev/api-keys`) | Lambda exec role only |
| AWS IAM credentials | `~/.aws/credentials` (local only) | Never committed to git |
| GitHub Actions auth | OIDC (no stored credentials) | Federated via `sts:AssumeRoleWithWebIdentity` |

## Audit Checklist

- [x] No hardcoded credentials in source code
- [x] No AWS account IDs in code (dynamically resolved via `data.aws_caller_identity`)
- [x] S3 public access blocked on all buckets (except static dashboard)
- [x] Server-side encryption on data lake
- [x] OIDC for CI/CD (no long-lived keys)
- [x] IAM roles scoped to specific resources
- [x] Git-secrets hooks installed (pre-commit)
- [x] `.gitignore` excludes `.env`, `keys/`, state files, credentials
- [x] Terraform state stored in S3 with DynamoDB locking (not in repo)
- [x] Root AWS access key deactivated

## Known Acceptable Risks (Portfolio Context)

| Risk | Mitigation | Rationale |
|------|-----------|-----------|
| CORS `*` on API | Portfolio demo, no sensitive data | Would add domain restriction in production |
| Public API (no auth) | Read-only, public EPL data | Would add API keys or Cognito for production |
| ECS on public IP | Security group limits to port 3000 | Would add ALB + ACM cert for production |
| Static dashboard on public S3 | Intentional — serves HTML fallback | No sensitive data exposed |
