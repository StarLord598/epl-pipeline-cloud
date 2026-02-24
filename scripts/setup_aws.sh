#!/usr/bin/env bash
# Initial AWS setup for EPL Pipeline cloud layer
# Run once to bootstrap Terraform state backend and initial config
# Usage: ./scripts/setup_aws.sh

set -euo pipefail

PROJECT="epl-pipeline"
REGION="${AWS_REGION:-us-east-2}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🏗️  EPL Pipeline — AWS Setup"
echo "   Region:  $REGION"
echo "   Account: $ACCOUNT_ID"
echo ""

# ── Terraform State Backend ───────────────────────────────────────────────────
STATE_BUCKET="${PROJECT}-terraform-state"
LOCK_TABLE="${PROJECT}-terraform-locks"

echo "📦 Creating Terraform state bucket: ${STATE_BUCKET}"
if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
    echo "   Already exists ✓"
else
    aws s3api create-bucket \
        --bucket "$STATE_BUCKET" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    aws s3api put-bucket-versioning \
        --bucket "$STATE_BUCKET" \
        --versioning-configuration Status=Enabled
    aws s3api put-bucket-encryption \
        --bucket "$STATE_BUCKET" \
        --server-side-encryption-configuration \
        '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
    aws s3api put-public-access-block \
        --bucket "$STATE_BUCKET" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    echo "   Created ✓"
fi

echo "🔒 Creating DynamoDB lock table: ${LOCK_TABLE}"
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" 2>/dev/null; then
    echo "   Already exists ✓"
else
    aws dynamodb create-table \
        --table-name "$LOCK_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$REGION"
    echo "   Created ✓"
fi

# ── Terraform Init ────────────────────────────────────────────────────────────
echo ""
echo "🔧 Initializing Terraform..."
cd "$(dirname "$0")/../infra/terraform"
terraform init

echo ""
echo "✅ AWS setup complete!"
echo ""
echo "Next steps:"
echo "  1. Set your API key:  aws secretsmanager put-secret-value \\"
echo "       --secret-id ${PROJECT}/dev/api-keys \\"
echo "       --secret-string '{\"FOOTBALL_DATA_API_KEY\":\"your-key\"}'"
echo "  2. Plan:    cd infra/terraform && terraform plan"
echo "  3. Apply:   cd infra/terraform && terraform apply"
echo "  4. Deploy:  ./scripts/deploy_lambdas.sh"
