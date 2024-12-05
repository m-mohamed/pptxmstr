#!/bin/bash
set -e  # Exit on any error

export ECR_REPO="381491839026.dkr.ecr.us-west-2.amazonaws.com/eliza-agent"
export AWS_REGION="us-west-2"

echo $ECR_REPO
echo $AWS_REGION

# Validate required environment variables
if [ -z "${ECR_REPO}" ]; then
    echo "Error: ECR_REPO environment variable must be set"
    exit 1
fi

if [ -z "${AWS_REGION}" ]; then
    echo "Error: AWS_REGION environment variable must be set"
    exit 1
fi

# Get Git information
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

# Transform branch name
SAFE_BRANCH=$(echo "${BRANCH}" | tr '/' '-' | tr -cd 'a-zA-Z0-9-.')
IMAGE_TAG="${SAFE_BRANCH}-${COMMIT}-dev"

# Debug output
echo "ECR Repository: ${ECR_REPO}"
echo "AWS Region: ${AWS_REGION}"
echo "Original Branch: ${BRANCH}"
echo "Safe Branch: ${SAFE_BRANCH}"
echo "Final Image Tag: ${ECR_REPO}:${IMAGE_TAG}"

# Build development image
docker build \
    --platform=linux/amd64 \
    -t "${ECR_REPO}:${IMAGE_TAG}" \
    --target development \
    --build-arg NODE_ENV=development \
    .

# Authenticate with ECR
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${ECR_REPO}

# Push development image to ECR
docker push ${ECR_REPO}:${IMAGE_TAG}

# Create a temporary task definition with substituted values
jq --arg img "381491839026.dkr.ecr.us-west-2.amazonaws.com/eliza-agent:${IMAGE_TAG}" \
  '.containerDefinitions[0].image = $img' task-definition.dev.json > task-definition.dev.tmp.json

# Register the task definition with resolved variables
aws ecs register-task-definition \
    --cli-input-json file://task-definition.dev.tmp.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text > task-definition.dev.arn

# Clean up temporary file
rm task-definition.dev.tmp.json

# Update the service with new task definition
aws ecs update-service \
    --cluster eliza-cluster \
    --service eliza-service \
    --task-definition $(cat task-definition.dev.arn) \
    --force-new-deployment

rm task-definition.dev.arn
