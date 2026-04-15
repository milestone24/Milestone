#!/bin/bash

# Uses the AWS profile and region from the current environment.

aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE CREATE_FAILED UPDATE_FAILED DELETE_FAILED \
  --query "StackSummaries[*].[StackName,StackStatus,CreationTime,LastUpdatedTime]" \
  --output table \
  --no-cli-pager
