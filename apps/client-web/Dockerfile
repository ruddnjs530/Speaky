# ==========================================
# Base Stage
# ==========================================
FROM node:20-alpine AS base

WORKDIR /app

# Copy package files (Context is Root)
COPY apps/client-web/package.json apps/client-web/package-lock.json ./

# Install dependencies
RUN npm ci

# ==========================================
# Development Stage
# ==========================================
FROM base AS dev

# Copy source code (Bind mount recommended instead)
COPY apps/client-web .

# Expose port
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev", "--", "--host"]

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder

# Copy source code
COPY apps/client-web .

# Build
RUN npm run build

# ==========================================
# Production Stage
# ==========================================
FROM nginx:alpine AS prod

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]
