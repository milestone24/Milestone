#!/bin/bash

SOURCE_DIR=$(dirname $0)

GHCR_OWNER=$(aws ssm get-parameter --name "/milestone/github-username" --with-decryption | jq -c .Parameter.Value | tr -d '"')
GHCR_TOKEN=$(aws ssm get-parameter --name "/milestone/github-token" --with-decryption | jq -c .Parameter.Value | tr -d '"')

# Deploy the container image to the registry

IMAGE_NAME="milestone-staging"
IMAGE_TAG="latest"
IMAGE_FULL_NAME="ghcr.io/$GHCR_OWNER/$IMAGE_NAME:$IMAGE_TAG"

docker run -p 5001:5001 $IMAGE_FULL_NAME --env-file $SOURCE_DIR/../../../.local.env

