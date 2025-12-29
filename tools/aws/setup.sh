#!/usr/bin/env bash
set -euo pipefail

# AWS SSM Parameter Setup for Milestone
# This script sets up required SSM parameters for the application

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=========================================="
echo "Milestone AWS SSM Parameter Setup"
echo "=========================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "ERROR: AWS CLI is not configured. Please run 'aws configure' first."
  exit 1
fi

echo "AWS Account: $(aws sts get-caller-identity --query Account --output text)"
echo "Region: $(aws configure get region || echo 'not set - using default')"
echo ""

# Function to check if parameter exists
param_exists() {
  aws ssm get-parameter --name "$1" &>/dev/null
}

# Function to set parameter if it doesn't exist
set_param_if_missing() {
  local name="$1"
  local description="$2"
  local type="${3:-SecureString}"
  
  if param_exists "$name"; then
    echo "✓ Parameter '$name' already exists"
    return 0
  fi
  
  echo ""
  echo "Parameter '$name' not found."
  echo "Description: $description"
  read -p "Enter value (or press Enter to skip): " value
  
  if [[ -n "$value" ]]; then
    aws ssm put-parameter \
      --name "$name" \
      --value "$value" \
      --type "$type" \
      --description "$description" \
      --overwrite
    echo "✓ Parameter '$name' created"
  else
    echo "⚠ Skipped '$name'"
  fi
}

echo "Checking required parameters..."
echo ""

# Core parameters
set_param_if_missing "/milestone/db-url-staging-one" "PostgreSQL database connection URL"
set_param_if_missing "/milestone/jwt-secret" "JWT signing secret"
set_param_if_missing "/milestone/refresh_token_secret" "Refresh token signing secret"
set_param_if_missing "/milestone/cookie_secret" "Cookie signing secret"

# GitHub parameters
set_param_if_missing "/milestone/github-token" "GitHub personal access token for GHCR"
set_param_if_missing "/milestone/github-username" "GitHub username for GHCR" "String"

# API keys
set_param_if_missing "/milestone/trading_212_api_key" "Trading 212 API key"
set_param_if_missing "/milestone/alpha_vantage_api_key" "Alpha Vantage API key"
set_param_if_missing "/milestone/eodhd_api_key" "EODHD API key"

# Token expiry (non-secure)
set_param_if_missing "/milestone/access_token_expiry" "Access token expiry duration (e.g., 15m)" "String"
set_param_if_missing "/milestone/refresh_token_expiry" "Refresh token expiry duration (e.g., 30d)" "String"

echo ""
echo "=========================================="
echo "System API Key Setup"
echo "=========================================="
echo ""

# Check if trigger API key exists
if param_exists "/milestone/trigger-api-key"; then
  echo "✓ Trigger API key already exists in SSM"
  read -p "Do you want to regenerate it? (y/N): " regenerate
  if [[ "$regenerate" != "y" && "$regenerate" != "Y" ]]; then
    echo "Keeping existing trigger API key"
  else
    echo ""
    echo "Generating new system API key..."
    echo "Running: npx tsx $PROJECT_ROOT/tools/aws/generate-system-api-key.ts"
    
    cd "$PROJECT_ROOT"
    API_KEY=$(npx tsx tools/aws/generate-system-api-key.ts 2>/dev/null)
    
    if [[ -n "$API_KEY" ]]; then
      aws ssm put-parameter \
        --name "/milestone/trigger-api-key" \
        --value "$API_KEY" \
        --type "SecureString" \
        --description "System API key for EventBridge triggers" \
        --overwrite
      echo "✓ Trigger API key regenerated and stored in SSM"
      echo ""
      echo "⚠️  IMPORTANT: The old API key is now invalid!"
    else
      echo "ERROR: Failed to generate API key"
      exit 1
    fi
  fi
else
  echo "Trigger API key not found. Generating..."
  echo ""
  
  cd "$PROJECT_ROOT"
  
  # Check if the generate script exists
  if [[ ! -f "tools/aws/generate-system-api-key.ts" ]]; then
    echo "ERROR: tools/aws/generate-system-api-key.ts not found"
    echo "Please create it first or manually set the parameter"
    exit 1
  fi
  
  echo "Running: npx tsx tools/aws/generate-system-api-key.ts"
  API_KEY=$(npx tsx tools/aws/generate-system-api-key.ts 2>/dev/null)
  
  if [[ -n "$API_KEY" ]]; then
    aws ssm put-parameter \
      --name "/milestone/trigger-api-key" \
      --value "$API_KEY" \
      --type "SecureString" \
      --description "System API key for EventBridge triggers"
    echo "✓ Trigger API key generated and stored in SSM"
  else
    echo "ERROR: Failed to generate API key"
    echo ""
    echo "You may need to:"
    echo "1. Ensure DATABASE_URL is set"
    echo "2. Run database migrations (npm run db:push)"
    echo "3. Seed the system tenant"
    exit 1
  fi
fi

echo ""
echo "=========================================="
echo "Setup Complete"
echo "=========================================="
echo ""
echo "All required SSM parameters have been configured."
echo "You can now deploy the application using: ./tools/aws/deploy.sh"
