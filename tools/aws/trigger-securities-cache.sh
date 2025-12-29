#!/usr/bin/env bash
set -euo pipefail

# Trigger securities cache update via AWS SSM
# This script invokes the securities-daily-history-cache-update endpoint on the EC2 instance

STACK_NAME="${1:-MilestoneStack}"

echo "=========================================="
echo "Trigger Securities Cache Update"
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

# Get the instance ID from CloudFormation outputs
# CDK prefixes output keys with construct ID, so look for MilestoneAppInstanceId or InstanceId
echo "Fetching instance ID from CloudFormation stack..."

# First check if stack exists
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
  echo "ERROR: Stack '$STACK_NAME' not found"
  echo ""
  echo "Available stacks:"
  aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[].StackName" --output table
  exit 1
fi

# Try to find instance ID with different possible output key names
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

# Check instance is running
INSTANCE_STATE=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].State.Name" \
  --output text 2>/dev/null || echo "unknown")

if [[ "$INSTANCE_STATE" != "running" ]]; then
  echo "ERROR: Instance is not running (state: $INSTANCE_STATE)"
  exit 1
fi

echo "Instance state: $INSTANCE_STATE"
echo ""

# Check if SSM agent is online
echo "Checking SSM agent status..."
SSM_STATUS=$(aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
  --query "InstanceInformationList[0].PingStatus" \
  --output text 2>/dev/null || echo "Unknown")

if [[ "$SSM_STATUS" != "Online" ]]; then
  echo "⚠ WARNING: SSM agent status: $SSM_STATUS"
  echo "The SSM agent may not be running or may not have connected yet."
  echo ""
  echo "Possible causes:"
  echo "  - Instance was recently started (wait a few minutes)"
  echo "  - SSM agent is not installed or not running"
  echo "  - Instance doesn't have proper IAM role for SSM"
  echo ""
  read -p "Do you want to continue anyway? (y/N): " continue_anyway
  if [[ "$continue_anyway" != "y" && "$continue_anyway" != "Y" ]]; then
    exit 1
  fi
else
  echo "SSM agent status: $SSM_STATUS"
fi
echo ""

# Send SSM command
echo "Sending SSM command to trigger securities cache update..."
echo ""

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["API_KEY=$(aws ssm get-parameter --name \"/milestone/trigger-api-key\" --with-decryption --query \"Parameter.Value\" --output text) && /opt/milestone/bin/trigger-securities-cache.sh \"$API_KEY\""]' \
  --query "Command.CommandId" \
  --output text)

echo "Command ID: $COMMAND_ID"
echo ""

# Wait for command to complete
echo "Waiting for command to complete..."
MAX_ATTEMPTS=60
ATTEMPT=0

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
  # Get command status
  INVOCATION=$(aws ssm list-command-invocations \
    --command-id "$COMMAND_ID" \
    --details \
    --output json 2>/dev/null || echo "{}")
  
  STATUS=$(echo "$INVOCATION" | jq -r '.CommandInvocations[0].Status // "Pending"')
  STATUS_DETAILS=$(echo "$INVOCATION" | jq -r '.CommandInvocations[0].StatusDetails // ""')
  
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
      
      # Try to get error output
      ERROR_OUTPUT=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "StandardErrorContent" \
        --output text 2>/dev/null || echo "")
      
      if [[ -n "$ERROR_OUTPUT" ]]; then
        echo "Error output:"
        echo "----------------------------------------"
        echo "$ERROR_OUTPUT"
        echo "----------------------------------------"
      fi
      
      # Show possible causes based on status
      case "$STATUS" in
        "Undeliverable")
          echo ""
          echo "Possible causes:"
          echo "  - SSM agent is not running on the instance"
          echo "  - Instance doesn't have proper IAM role"
          echo "  - Network connectivity issues"
          ;;
        "TimedOut")
          echo ""
          echo "Possible causes:"
          echo "  - Command took too long to execute"
          echo "  - The endpoint may be slow to respond"
          ;;
      esac
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
echo ""
echo "Or check AWS Systems Manager console:"
echo "  https://console.aws.amazon.com/systems-manager/run-command"
exit 1

