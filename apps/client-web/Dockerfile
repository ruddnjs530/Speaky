# ==========================================
# Base Stage
# ==========================================
FROM node:20.11.1-alpine3.19 AS base
WORKDIR /app
COPY apps/client-web/package.json apps/client-web/package-lock.json ./
# Why: 'ci' ensures we use the exact versions in lockfile
RUN npm ci

# ==========================================
# Development Stage
# ==========================================
FROM base AS dev
# Why: Copy remaining files for initial build, but Volume mount in compose overrides this for live edits
COPY apps/client-web .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
# Updated: Explicitly copy source for builder
COPY apps/client-web .

# Inject Build-time Variables
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Bypass tsc for demo stability
RUN npx vite build

# ==========================================
# Production Stage
# ==========================================
FROM nginx:1.25-alpine AS prod
# Updated: Correctly reference builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Fix: Remove default config and copy custom nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/client-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
