#!/usr/bin/env bash
# Deploy Lambda functions to AWS
# Usage: ./scripts/deploy_lambdas.sh [function_name]
# Examples:
#   ./scripts/deploy_lambdas.sh              # Deploy all
#   ./scripts/deploy_lambdas.sh daily_ingest # Deploy one

set -euo pipefail

PROJECT="epl-pipeline"
ENV="${ENVIRONMENT:-dev}"
REGION="${AWS_REGION:-us-east-2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR/../lambda"

deploy_function() {
    local func_dir="$1"
    local func_name="$2"
    local aws_name="${PROJECT}-${func_name}-${ENV}"

    echo "📦 Packaging ${func_name}..."
    cd "$LAMBDA_DIR/$func_dir"
    rm -rf package/ *.zip
    pip3 install -r requirements.txt -t package/ --quiet
    cp handler.py package/
    cd package
    zip -r9 "../${func_name}.zip" . > /dev/null
    cd ..

    local s3_bucket="${PROJECT}-lambda-deploy-${ENV}-$(aws sts get-caller-identity --query Account --output text)"
    local s3_key="lambda/${func_name}.zip"

    echo "⬆️  Uploading to s3://${s3_bucket}/${s3_key}..."
    aws s3 cp "${func_name}.zip" "s3://${s3_bucket}/${s3_key}" --region "$REGION"

    echo "🚀 Deploying ${aws_name}..."
    aws lambda update-function-code \
        --function-name "$aws_name" \
        --s3-bucket "$s3_bucket" \
        --s3-key "$s3_key" \
        --region "$REGION"

    rm -rf package/
    echo "✅ ${aws_name} deployed"
}

FUNCTIONS=("daily_ingest:daily-ingest" "live_matches:live-matches" "backfill:backfill")

if [ "${1:-}" ]; then
    for entry in "${FUNCTIONS[@]}"; do
        dir="${entry%%:*}"
        name="${entry##*:}"
        if [ "$dir" = "$1" ] || [ "$name" = "$1" ]; then
            deploy_function "$dir" "$name"
            exit 0
        fi
    done
    echo "❌ Unknown function: $1"
    echo "Available: ${FUNCTIONS[*]}"
    exit 1
fi

for entry in "${FUNCTIONS[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"
    deploy_function "$dir" "$name"
done

echo ""
echo "🎉 All Lambda functions deployed!"
