#!/bin/bash
# dev.deploy.sh

# Get the current branch and commit
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

# Build development image for ECR
docker build -t ${ECR_REPO}:${BRANCH}-${COMMIT}-dev \
    --target development \
    --build-arg NODE_ENV=development .

# Authenticate with ECR
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${ECR_REPO}

# Push development image to ECR
docker push ${ECR_REPO}:${BRANCH}-${COMMIT}-dev

# Create a temporary task definition with substituted values
IMAGE_TAG="${BRANCH}-${COMMIT}-dev"
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
