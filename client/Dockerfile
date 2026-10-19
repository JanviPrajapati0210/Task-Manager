# =============================================================================
# Stage 1: Build Stage (Vite + React compilation)
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install project dependencies cleanly
RUN npm ci

# Build argument for the backend API URL (default to localhost:5000 for browser clients)
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

# Copy frontend source files
COPY . .

# Build the production-ready static assets in /app/dist
RUN npm run build

# =============================================================================
# Stage 2: Production Stage (Lightweight Nginx Web Server)
# =============================================================================
FROM nginx:alpine AS production

# Clean default Nginx html directory
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration supporting React Router client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check to ensure Nginx is serving the frontend
HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
