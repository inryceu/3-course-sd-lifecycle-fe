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

# Same-origin defaults so the SPA works behind the nginx proxy of the full stack.
ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL

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

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]