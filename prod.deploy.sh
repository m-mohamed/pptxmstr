#!/bin/bash
# prod.deploy.sh

# Strict error handling
set -euo pipefail

# Branch validation for production deployment integrity
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

# Enforce production branch requirement
if [ "$BRANCH" = "main" ]; then
    echo "Error: Production deployments cannot be made from the 'main' branch"
    echo "Main branch is reserved for development. Please merge changes to 'prod' branch first"
    exit 1
elif [ "$BRANCH" != "prod" ]; then
    echo "Error: Production deployments must originate from the 'prod' branch"
    echo "Current branch: $BRANCH"
    echo "Neither 'main' nor arbitrary feature branches are permitted for production deployments"
    echo "Please ensure your changes are properly merged into the 'prod' branch"
    exit 1
fi

# Validate working directory state
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working directory contains uncommitted changes"
    echo "Please commit or stash changes before proceeding with production deployment"
    exit 1
fi

# Generate production image tag
IMAGE_TAG="${BRANCH}-${COMMIT}-prod"

# Create temporary task definition with resolved variables
jq --arg img "381491839026.dkr.ecr.us-west-2.amazonaws.com/eliza-agent:${IMAGE_TAG}" \
   '.containerDefinitions[0].image = $img' task-definition.prod.json > task-definition.prod.tmp.json

# Build and push production image
docker build -t ${ECR_REPO}:${IMAGE_TAG} \
  --target production \
  --build-arg NODE_ENV=production .

# Authenticate with ECR
aws ecr get-login-password --region us-west-2 | \
    docker login --username AWS --password-stdin ${ECR_REPO}

# Push images with both specific and stable tags
docker push ${ECR_REPO}:${IMAGE_TAG}
docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_REPO}:prod
docker push ${ECR_REPO}:prod

# Register new task definition with resolved variables
NEW_TASK_DEF=$(aws ecs register-task-definition \
    --cli-input-json file://task-definition.prod.tmp.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

# Clean up temporary task definition
rm task-definition.prod.tmp.json

# Update service with new task definition
aws ecs update-service \
    --cluster eliza-cluster \
    --service eliza-service \
    --task-definition ${NEW_TASK_DEF} \
    --force-new-deployment \
    --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100"

# Monitor deployment stability
echo "Monitoring deployment status..."
aws ecs wait services-stable \
    --cluster eliza-cluster \
    --services eliza-service

# Deployment status validation
if [ $? -eq 0 ]; then
    echo "Production deployment completed successfully"
    echo "Deployed version: ${IMAGE_TAG}"
    echo "Branch: ${BRANCH}"
    echo "Commit: ${COMMIT}"
else
    echo "Error: Deployment did not stabilize within the expected timeframe"
    echo "Please check ECS console for detailed status"
    exit 1
fi
