#!/usr/bin/env bash
set -euo pipefail

# Trigger cache invalidation via AWS SSM
# This script invokes the /api/triggers/invalidate-cache endpoint on the EC2 instance

STACK_NAME="${1:-MilestoneStack}"

AVAILABLE_NAMESPACES=("portfolio" "assets")

echo "=========================================="
echo "Trigger Cache Invalidation"
echo "=========================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "ERROR: AWS CLI is not configured. Please run 'aws configure' first."
  exit 1
fi

echo "AWS Account: $(aws sts get-caller-identity --query Account --output text)"
echo "Stack: $STACK_NAME"
echo ""

# Check stack exists
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
  echo "ERROR: Stack '$STACK_NAME' not found"
  echo ""
  echo "Available stacks:"
  aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[].StackName" --output table
  exit 1
fi

# Get instance ID from outputs (same strategy as trigger-securities-cache.sh)
echo "Fetching instance ID from CloudFormation stack..."
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'InstanceId')].OutputValue | [0]" \
  --output text 2>/dev/null || echo "")

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" || "$INSTANCE_ID" == "null" ]]; then
  echo "ERROR: Could not find instance ID output in stack '$STACK_NAME'"
  echo ""
  echo "Available outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[*].[OutputKey, OutputValue]" \
    --output table
  exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo ""

echo "Choose what to invalidate:"
echo "  0) ALL (clear everything)"
i=1
for ns in "${AVAILABLE_NAMESPACES[@]}"; do
  echo "  $i) $ns"
  i=$((i + 1))
done
echo "  m) multiple (comma-separated numbers, e.g. 1,2)"
echo "  c) custom (comma-separated names, e.g. portfolio,assets)"
echo "  q) quit"
echo ""
read -r -p "Selection: " SELECTION

PAYLOAD_B64=""

build_payload_b64() {
  local json="$1"
  PAYLOAD_B64="$(printf '%s' "$json" | base64 | tr -d '\n')"
}

build_payload_from_namespaces_csv() {
  local csv="$1"
  csv="${csv// /}"
  if [[ -z "$csv" ]]; then
    echo "ERROR: No namespaces provided."
    exit 1
  fi

  IFS=',' read -r -a NS_ARR <<< "$csv"

  local json='{"namespaces":['
  for ns in "${NS_ARR[@]}"; do
    [[ -z "$ns" ]] && continue
    json="$json\"$ns\","
  done
  json="${json%,}]}"

  build_payload_b64 "$json"
}

case "$SELECTION" in
  0)
    # No payload means "invalidate all" on the server side
    ;;
  q|Q)
    echo "Cancelled."
    exit 0
    ;;
  c|C)
    read -r -p "Enter namespaces (comma-separated, e.g. portfolio,assets): " CUSTOM_NS
    build_payload_from_namespaces_csv "$CUSTOM_NS"
    ;;
  m|M)
    echo ""
    read -r -p "Enter selection numbers (comma-separated, e.g. 1,2): " MULTI
    MULTI="${MULTI// /}"
    if [[ -z "$MULTI" ]]; then
      echo "ERROR: No selections provided."
      exit 1
    fi
    IFS=',' read -r -a IDX_ARR <<< "$MULTI"
    selected_csv=""
    for idxStr in "${IDX_ARR[@]}"; do
      if ! [[ "$idxStr" =~ ^[0-9]+$ ]]; then
        echo "ERROR: Invalid selection '$idxStr'."
        exit 1
      fi
      idx=$((idxStr - 1))
      if [[ "$idx" -lt 0 || "$idx" -ge "${#AVAILABLE_NAMESPACES[@]}" ]]; then
        echo "ERROR: Selection '$idxStr' is out of range."
        exit 1
      fi
      ns="${AVAILABLE_NAMESPACES[$idx]}"
      if [[ -z "$selected_csv" ]]; then
        selected_csv="$ns"
      else
        selected_csv="$selected_csv,$ns"
      fi
    done
    build_payload_from_namespaces_csv "$selected_csv"
    ;;
  *)
    # single numeric selection
    if ! [[ "$SELECTION" =~ ^[0-9]+$ ]]; then
      echo "ERROR: Invalid selection."
      exit 1
    fi
    idx=$((SELECTION - 1))
    if [[ "$idx" -lt 0 || "$idx" -ge "${#AVAILABLE_NAMESPACES[@]}" ]]; then
      echo "ERROR: Invalid selection."
      exit 1
    fi
    ns="${AVAILABLE_NAMESPACES[$idx]}"
    build_payload_b64 "{\"namespaces\":[\"$ns\"]}"
    ;;
esac

echo ""
echo "Sending SSM command to trigger cache invalidation..."
echo ""

if [[ -n "$PAYLOAD_B64" ]]; then
  COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["API_KEY=$(aws ssm get-parameter --name \"/milestone/trigger-api-key\" --with-decryption --query \"Parameter.Value\" --output text) && /opt/milestone/bin/trigger-invalidate-cache.sh \"$API_KEY\" \"'"$PAYLOAD_B64"'\""]' \
    --query "Command.CommandId" \
    --output text)
else
  COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["API_KEY=$(aws ssm get-parameter --name \"/milestone/trigger-api-key\" --with-decryption --query \"Parameter.Value\" --output text) && /opt/milestone/bin/trigger-invalidate-cache.sh \"$API_KEY\""]' \
    --query "Command.CommandId" \
    --output text)
fi

echo "Command ID: $COMMAND_ID"

# Wait for command to complete (same UX as trigger-securities-cache.sh)
echo ""
echo "Waiting for command to complete..."
MAX_ATTEMPTS=60
ATTEMPT=0

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
  STATUS=$(aws ssm list-command-invocations \
    --command-id "$COMMAND_ID" \
    --details \
    --query "CommandInvocations[0].Status" \
    --output text 2>/dev/null || echo "Pending")

  STATUS_DETAILS=$(aws ssm list-command-invocations \
    --command-id "$COMMAND_ID" \
    --details \
    --query "CommandInvocations[0].StatusDetails" \
    --output text 2>/dev/null || echo "")

  case "$STATUS" in
    "Success")
      echo ""
      echo "✓ Command completed successfully!"
      echo ""
      echo "Command output:"
      echo "----------------------------------------"
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "StandardOutputContent" \
        --output text 2>/dev/null || echo "(no output)"
      echo "----------------------------------------"
      exit 0
      ;;
    "Failed"|"Cancelled"|"TimedOut"|"Undeliverable"|"Terminated")
      echo ""
      echo "✗ Command failed with status: $STATUS"
      [[ -n "$STATUS_DETAILS" ]] && echo "Details: $STATUS_DETAILS"
      echo ""

      ERROR_OUTPUT=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "StandardErrorContent" \
        --output text 2>/dev/null || echo "")

      if [[ -n "$ERROR_OUTPUT" && "$ERROR_OUTPUT" != "None" ]]; then
        echo "Error output:"
        echo "----------------------------------------"
        echo "$ERROR_OUTPUT"
        echo "----------------------------------------"
      fi

      exit 1
      ;;
    "InProgress"|"Pending"|"Delayed")
      if [[ $((ATTEMPT % 10)) -eq 0 && $ATTEMPT -gt 0 ]]; then
        echo " ($STATUS)"
      else
        printf "."
      fi
      sleep 2
      ATTEMPT=$((ATTEMPT + 1))
      ;;
    *)
      # Status might be empty if invocation hasn't been registered yet
      printf "."
      sleep 2
      ATTEMPT=$((ATTEMPT + 1))
      ;;
  esac
done

echo ""
echo "⚠ Command timed out waiting for response (2 minutes)"
echo ""
echo "Debug information:"
echo "  Command ID: $COMMAND_ID"
echo "  Instance ID: $INSTANCE_ID"
echo ""
echo "Check status manually:"
echo "  aws ssm get-command-invocation --command-id $COMMAND_ID --instance-id $INSTANCE_ID"
exit 1

