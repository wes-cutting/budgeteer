# ============================================================================
# budgeteer — production image (BUD-S81 · ADR-0008)
#
# ONE image, ONE origin: the web SPA is built to static assets and served by the
# same Fastify process that serves the API (ADR-0008 §1). That collapses CORS to
# same-origin and leaves the hub a single container to pull, run, and observe.
#
# Target: linux/arm64 (Raspberry Pi 5). Built in CI and pulled by the hub —
# never built on the node (ADR-0008 §4).
#
#   docker build --platform linux/arm64 -t budgeteer:dev .
#
# State lives in Postgres (ADR-0008 §6); this image is stateless and owns no volume.
# ============================================================================

# Node 22 (active LTS). Deliberately AHEAD of the repo's dev/CI Node 20, which went
# end-of-life in April 2026: an image that serves a household ledger on the LAN should
# still be receiving security patches. The runtime is exercised on this exact version by
# the compose harness, and the esbuild `target` in apps/api/scripts/build.ts is kept in step.
ARG NODE_VERSION=22-bookworm-slim

# --- Stage 1: build both workspaces ------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Manifests first, so the dependency layer caches independently of source edits.
# Every workspace manifest is copied because `npm ci` validates the whole lockfile.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/domain packages/domain
COPY apps/api apps/api
COPY apps/web apps/web

# Same-origin: an EMPTY base makes the client issue relative requests (`/accounts`), which
# the serving process answers itself. It must be set explicitly — unset would fall through
# to the dev default of http://localhost:3001 and the deployed SPA would call the user's
# own machine. (Empty string is not nullish, so it survives the `??` default in api.ts.)
ENV VITE_API_BASE_URL=""
RUN npm run build --workspace @budgeteer/web

# esbuild bundles the API + domain into plain ESM that `node` can run without tsx.
RUN npm run build --workspace @budgeteer/api

# --- Stage 2: runtime --------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    APP_ENV=production \
    PORT=3001 \
    # Serve every interface: inside a container this is the container's own network
    # namespace, not the host's. Safe as of BUD-E13 — default-deny auth is in place
    # (ADR-0009), which was the documented precondition (SECURITY.md §3).
    HOST=0.0.0.0 \
    WEB_STATIC_ROOT=/app/apps/web/dist

# Runtime dependencies only: `--omit=dev` drops the toolchain, and scoping to the API
# workspace leaves out the SPA's build-time deps (React et al.) — they are already baked
# into the static assets. Still driven by the lockfile, so the install is reproducible.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
RUN npm ci --omit=dev --workspace @budgeteer/api --include-workspace-root \
    && npm cache clean --force

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/web/dist apps/web/dist

# Drop root: the `node` user ships with the base image. The app writes nothing to disk
# (state is in Postgres), so it needs no ownership beyond read access.
USER node

EXPOSE 3001

# Readiness, not just liveness — /health reports DB reachability (BUD-S82), so an
# unhealthy container is one that cannot actually serve, not merely one that is down.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
