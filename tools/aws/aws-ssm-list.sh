#!/bin/bash

# Uses the AWS profile and region from the current environment.
#
# Usage:
#   ./scripts/ssm-list.sh                    # list all SSM parameters (SecureString values masked)
#   ./scripts/ssm-list.sh /dp/api            # list parameters under a path prefix
#   ./scripts/ssm-list.sh /dp/api --reveal   # decrypt and show SecureString values
#   ./scripts/ssm-list.sh --reveal           # reveal all parameters

PATH_PREFIX="/"
DECRYPT=false

echo "PATH_PREFIX: $PATH_PREFIX"
echo "DECRYPT: $DECRYPT"

for arg in "$@"; do
  if [[ "$arg" == "--reveal" ]]; then
    DECRYPT=true
  elif [[ "$arg" == /* ]]; then
    PATH_PREFIX="$arg"
  fi
done

EXTRA_FLAGS=""
if [[ "$DECRYPT" == true ]]; then
  EXTRA_FLAGS="--with-decryption"
fi

aws ssm get-parameters-by-path \
  --path "$PATH_PREFIX" \
  --recursive \
  $EXTRA_FLAGS \
  --query "Parameters[*].[Name,Value]" \
  --output table \
  --no-cli-pager
