# =============================================================================
# BoardSync Frontend - Multi-stage Dockerfile
# =============================================================================
# Stage 1: Base image with pnpm
# Stage 2: Dependencies
# Stage 3: Builder (compile TypeScript + Vite build)
# Stage 4: Development (Vite dev server with HMR)
# Stage 5: Production (Nginx static file server)
# =============================================================================

# -----------------------------------------------------------------------------
# BASE STAGE
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml* ./

# -----------------------------------------------------------------------------
# DEPS STAGE - Install all dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

RUN pnpm install --frozen-lockfile --prod=false

# -----------------------------------------------------------------------------
# BUILDER STAGE - Build production assets
# -----------------------------------------------------------------------------
FROM deps AS builder

COPY . .

RUN pnpm build

# -----------------------------------------------------------------------------
# DEVELOPMENT STAGE - Vite dev server with HMR
# -----------------------------------------------------------------------------
FROM deps AS development

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S vite -u 1001 -G nodejs

RUN chown -R vite:nodejs /app
USER vite

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# -----------------------------------------------------------------------------
# PRODUCTION STAGE - Nginx static server
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d /etc/nginx/conf.d

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]