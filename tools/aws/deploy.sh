#!/usr/bin/env bash

INSTANCE_ID=$(aws ec2 describe-instances --filters 'Name=tag:Name,Values=MilestoneStack/MilestoneApp/Instance' --filters 'Name=instance-state-name,Values=running' |
  jq -c ".Reservations[].Instances[] | .InstanceId" | tr -d '"')

echo "INSTANCE_ID: $INSTANCE_ID"

GHCR_OWNER=$(aws ssm get-parameter --name "/milestone/github-username" --with-decryption | jq -c .Parameter.Value | tr -d '"')
GHCR_TOKEN=$(aws ssm get-parameter --name "/milestone/github-token" --with-decryption | jq -c .Parameter.Value | tr -d '"')

GHCR_REPO="milestone-staging"
GHCR_TAG="latest"

COMMAND_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"runuser -l ec2-user -c /opt/milestone/bin/deploy.sh ghcr.io/${GHCR_OWNER}/${GHCR_REPO}:${GHCR_TAG}\"]" \
  --query "Command.CommandId" \
  --output text)

echo "COMMAND_ID: $COMMAND_ID"

aws ssm wait command-executed \
  --command-id $COMMAND_ID \
  --instance-id $INSTANCE_ID

aws ssm get-command-invocation \
  --command-id $COMMAND_ID \
  --instance-id $INSTANCE_ID \
  --query "StandardOutputContent" \
  --output text