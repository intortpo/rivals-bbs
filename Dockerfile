# Multi-stage Dockerfile for Airsoft BBS (Google Cloud Run)
# Stage 1: Build client assets & typecheck
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy source code and assets
COPY . .

# Build client bundle and verify TypeScript
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package manifests & install production dependencies + tsx runner
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy compiled client bundle & public 3D models/assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy server code and shared definitions
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY tsconfig.json ./

# Ensure data directory exists for user database
RUN mkdir -p /app/data

EXPOSE 8080

# Start server using tsx
CMD ["tsx", "src/server/server.ts"]
