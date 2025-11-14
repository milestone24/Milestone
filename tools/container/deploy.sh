#!/bin/bash

GHCR_OWNER=$(aws ssm get-parameter --name "/milestone/github-username" --with-decryption | jq -c .Parameter.Value | tr -d '"')
GHCR_TOKEN=$(aws ssm get-parameter --name "/milestone/github-token" --with-decryption | jq -c .Parameter.Value | tr -d '"')

# Deploy the container image to the registry

IMAGE_NAME="milestone-staging"
IMAGE_TAG="latest"
IMAGE_FULL_NAME="ghcr.io/$GHCR_OWNER/$IMAGE_NAME:$IMAGE_TAG"
# Build the container
docker build -t $IMAGE_FULL_NAME .

#TODO get the token from the environment variable
#TODO use --password-stdin
docker login -u $GHCR_OWNER -p $GHCR_TOKEN ghcr.io

# Push the container to the registry
docker push $IMAGE_FULL_NAME