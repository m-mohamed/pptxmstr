# Better maintainability and readability of the Dockerfile
ARG NODE_VERSION=23.3.0
ARG PNPM_VERSION=9.4.0
ARG TURBO_VERSION=1.10.17

# Base image with shared configuration
FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
ARG TURBO_VERSION
ENV PNPM_VERSION=${PNPM_VERSION}
ENV TURBO_VERSION=${TURBO_VERSION}
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
    npm install -g pnpm@${PNPM_VERSION} turbo@${TURBO_VERSION} && \
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

# Create directory structure for packages
RUN mkdir -p \
    agent \
    scripts \
    characters \
    packages/adapter-postgres \
    packages/adapter-sqlite \
    packages/adapter-sqljs \
    packages/adapter-supabase \
    packages/client-auto \
    packages/client-direct \
    packages/client-discord \
    packages/client-telegram \
    packages/client-twitter \
    packages/core \
    packages/plugin-aptos \
    packages/plugin-bootstrap \
    packages/plugin-image-generation \
    packages/plugin-node \
    packages/plugin-solana \
    packages/plugin-evm \
    packages/plugin-tee

# Copy the rest of the application code
COPY agent ./agent
COPY packages ./packages
COPY scripts ./scripts
COPY characters ./characters


# Verify turbo installation && Install dependencies and build the project
RUN turbo --version && \
    pnpm install --fetch-timeout 300000 || (sleep 5 && pnpm install --fetch-timeout 300000) \
    && pnpm build \
    && pnpm prune --prod


# Development stage
FROM base AS development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true


# Install additional development tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        vim \
        curl \
        procps \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create the same directory structure for volume mounting
RUN mkdir -p \
    agent \
    scripts \
    characters \
    packages/adapter-postgres/src \
    packages/adapter-sqlite/src \
    packages/adapter-sqljs/src \
    packages/adapter-supabase/src \
    packages/client-auto/src \
    packages/client-direct/src \
    packages/client-discord/src \
    packages/client-telegram/src \
    packages/client-twitter/src \
    packages/core/src \
    packages/core/types \
    packages/plugin-aptos/src \
    packages/plugin-bootstrap/src \
    packages/plugin-image-generation/src \
    packages/plugin-node/src \
    packages/plugin-solana/src \
    packages/plugin-evm/src \
    packages/plugin-tee/src


# Copy built artifacts and production dependencies from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
#COPY --from=builder /app/agent ./agent
#COPY --from=builder /app/packages ./packages
#COPY --from=builder /app/scripts ./scripts
#COPY --from=builder /app/characters ./characters


# Development-specific entrypoint script
COPY --chmod=755 <<EOF /usr/local/bin/docker-entrypoint.sh
#!/bin/bash
# Ensure proper ownership of mounted volumes
chown -R node:node /app

# Execute the main command
exec "$@"
EOF


ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
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
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/.npmrc ./
COPY --from=builder --chown=nodejs:nodejs /app/turbo.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/agent ./agent
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/characters ./characters

# Health check for AWS ECS
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set the command to run the application
CMD ["pnpm", "start", "--characters=\"characters/pptxmstr.character.json\"", "--non-interactive"]

