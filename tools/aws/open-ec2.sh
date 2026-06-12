#!/usr/bin/env bash

EC2_HOST=export EC2_HOST=$(aws ec2 describe-instances --filters 'Name=tag:Name,Values=MilestoneStack/MilestoneApp/Instance' |
  jq -c ".Reservations[].Instances[] | { State: .State.Name, PublicIpAddress: .PublicIpAddress } |    select(.State | contains(\"running\")) | .PublicIpAddress" | sed -e 's/[.]/-/g' | xargs -I {} echo "ec2-"{})
AWS_REGION=$(aws configure get region)
EC2_DNS=${EC2_HOST}.${AWS_REGION}.compute.amazonaws.com
EC2_USER=ec2-user
EC2_SSH_KEY=~/.ssh/milestone-primary.pem
EC2_REMOTE="${EC2_USER}@${EC2_DNS}"

echo "Connecting to ${EC2_REMOTE}"
ssh -i ${EC2_SSH_KEY} ${EC2_REMOTE}
