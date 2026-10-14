# syntax=docker/dockerfile:1.7
#
# JobTrack images (one Dockerfile, three targets):
#   web     - Next.js standalone server (port 3000, non-root)
#   worker  - Graphile Worker process (no ports, non-root)
#   migrate - one-off: prisma migrate deploy + Graphile Worker schema
#
# Build: docker build --target web -t jobtrack-web .

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat && npm install -g pnpm@11.17.0
WORKDIR /app

# All dependencies (build tooling, Prisma CLI). postinstall generates the
# Prisma client into src/generated.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# No secrets are needed at build time: env is validated lazily at runtime.
RUN pnpm build

# Production-only dependencies for the worker (scripts skipped: the Prisma
# client is copied from the build stage instead of regenerated).
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod --ignore-scripts

FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "server.js"]

FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production \
    WORKER_HEARTBEAT_FILE=/tmp/jobtrack-worker-heartbeat
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/src ./src
USER node
# Healthy while the worker refreshes its heartbeat file (every 30 s).
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD sh -c 'test -n "$(find "$WORKER_HEARTBEAT_FILE" -mmin -2 2>/dev/null)"' || exit 1
# Graceful shutdown: Graphile Worker finishes running jobs on SIGTERM.
STOPSIGNAL SIGTERM
CMD ["node_modules/.bin/tsx", "src/worker/index.ts"]

FROM deps AS migrate
ENV NODE_ENV=production
RUN chown -R node:node /app
USER node
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec graphile-worker --schema-only"]
