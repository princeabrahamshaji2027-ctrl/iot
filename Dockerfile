# AgroConnect-IoT Production Container
# Base image: Official Node.js LTS on Alpine Linux for minimal size & security
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install production dependencies first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application backend & frontend assets
COPY server.js db.js ./
COPY public/ ./public/

# Run as non-privileged user for container security
USER node

# Environment defaults (Render overrides PORT and DATABASE_URL)
ENV PORT=10000 \
    NODE_ENV=production

# Document exposed port
EXPOSE 10000

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/health || exit 1

# Production startup command
CMD ["node", "server.js"]

