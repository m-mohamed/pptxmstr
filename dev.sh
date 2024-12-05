#!/bin/bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)
SAFE_BRANCH=$(echo "${BRANCH}" | tr '/' '-' | tr -cd 'a-zA-Z0-9-.')
IMAGE_TAG="${SAFE_BRANCH}-${COMMIT}-dev"

docker build \
  --platform linux/amd64 \
  -t ${SAFE_BRANCH}:${IMAGE_TAG} \
  --target development \
  --build-arg NODE_ENV=development \
  .

docker-compose -f docker-compose.dev.yaml up
