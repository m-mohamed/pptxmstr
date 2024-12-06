# Better maintainability and readability of the Dockerfile
ARG NODE_VERSION=23.3.0
ARG PNPM_VERSION=9.4.0


# Base image with shared configuration
FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
ENV PNPM_VERSION=${PNPM_VERSION}
ENV NODE_ENV=production

# Install common dependencies and cleanup in a single layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        python3 \
        ca-certificates \
        && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    # update certs
    update-ca-certificates && \
    # install pnpm with npm
    npm install -g pnpm@${PNPM_VERSION} && \
    # configure git to use HTTPS instead of git protocol
    git config --global url."https://".insteadOf git:// && \
    # Cleanup
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


# Set the working directory
WORKDIR /app



# Builder stage for compilation and dependencies
FROM base AS builder
# Install additional build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        make \
        g++ \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


# Configure pnpm for better network reliability
RUN pnpm config set fetch-timeout 300000 \
    && pnpm config set strict-ssl false \
    && git config --global http.sslVerify false


# Copy package.json and other configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
# Copy the rest of the application code
COPY agent ./agent
COPY packages ./packages
COPY scripts ./scripts
COPY characters ./characters


# Install dependencies and build the project
RUN pnpm install --fetch-timeout 300000 || (sleep 5 && pnpm install --fetch-timeout 300000) \
    && pnpm build \
    && pnpm prune --prod


# Development stage
FROM base AS development
ENV NODE_ENV=development
# Install additional development tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        vim \
        curl \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


# Copy built artifacts and production dependencies from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/agent ./agent
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/characters ./characters


# Enable file system watching for development
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true


# Set the command to run the application
CMD ["pnpm", "start", "--characters=\"characters/pptxmstr.character.json\""]


# Production stage optimized for AWS ECS/ECR
FROM base AS production
# AWS-specific environment variables
ENV NODE_ENV=production
ENV AWS_NODEJS_CONNECTION_REUSE_ENABLED=1

# Production-specific security hardening
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs && \
    chown -R nodejs:nodejs /app


USER nodejs


# Copy built artifacts and production dependencies from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/agent ./agent
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/characters ./characters

# Health check for AWS ECS
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set the command to run the application
CMD ["pnpm", "start", "--characters=\"characters/pptxmstr.character.json\"", "--non-interactive"]

