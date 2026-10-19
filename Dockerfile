# =============================================================================
# Node.js & Express Backend Dockerfile
# =============================================================================
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests first for optimal layer caching
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the rest of the backend application code
COPY . .

# Expose the API server port
EXPOSE 5000

# Health check to ensure the API server is responsive
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/cache/stats || exit 1

# Start the Express server
CMD ["node", "server.js"]
