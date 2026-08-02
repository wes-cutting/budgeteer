---
type: reference
status: Implemented
---
<!--
DEPLOY CONTRACT — the stable interface labs-hub (LH-S3) consumes to run budgeteer.
Finalizes §5 of the 2026-07-27 hub deployment-readiness initiative (BUD-S83).
Runtime shape: ADR-0008. Auth: ADR-0009. Change policy in §8 — this file is a promise
to another project, so breaking any of it is a coordinated change, not a refactor.
-->

# Deploy contract — budgeteer on labs-hub

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Status       | Implemented — validated by `scripts/validate-deploy.sh` against PostgreSQL 16 (arm64) |
| Owner        | Wesley Cutting                                                            |
| Consumer     | labs-hub `LH-S3`                                                          |
| Last updated | 2026-08-01                                                                |
| Decisions    | [`ADR-0008`](adr/ADR-0008-containerized-production-runtime.md) (runtime) · [`ADR-0009`](adr/ADR-0009-authentication-household-scoping.md) (auth) |

> budgeteer is a **single-household, LAN-only** self-hosted service. Not multi-tenant, not
> public-internet (initiative §8). A reference `docker compose` file lives at
> [`deploy/compose.yaml`](../deploy/compose.yaml) — that file *is* the worked example of everything below.

## 1. Image

| | |
| --- | --- |
| Registry | `ghcr.io/wes-cutting/budgeteer` |
| Tags | a release tag (e.g. `v0.3.0`); pull by tag or digest |
| Platform | `linux/arm64` (Raspberry Pi 5) |
| Size | ~82 MB |
| Base | `node:22-bookworm-slim` |
| User | runs as the non-root `node` user |
| Build | GitHub Actions → GHCR. **Never built on the Pi** (ADR-0008 §4) |

**One image serves both halves.** The Fastify process serves the API *and* the built SPA, so there
is one container, one port, one origin — no web container, no nginx sidecar.

## 2. Ports

| Port | Purpose |
| ---- | ------- |
| `3001` | everything — the SPA, the API, and `/api/health`. Configurable via `PORT`. |

Nothing else is exposed. The database port is **not** published: the app reaches Postgres over the
internal compose network, so no LAN device can open a Postgres connection to the ledger.

## 3. Environment

**Required** — the container fails to start, loudly, without these:

| Variable | Value | Why it is required |
| -------- | ----- | ------------------ |
| `APP_ENV` | `production` | Selects the production profile (which enforces the two below). |
| `DATABASE_URL` | `postgres://budgeteer:<pw>@db:5432/budgeteer` | PGlite is not in the production image; there is no fallback store, and quietly serving the ledger from an ephemeral one would lose every write on restart. |
| `SESSION_SECRET` | ≥ 16 chars; `openssl rand -base64 48` | Signs the session cookie. Unsigned sessions are forgeable. |

**Optional** — with the defaults the image already sets:

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `HOST` | `0.0.0.0` | Safe as of BUD-E13: auth is default-deny at the resource level. |
| `PORT` | `3001` | |
| `WEB_STATIC_ROOT` | `/app/apps/web/dist` | Where the SPA is served from. Startup fails if it holds no `index.html`. |
| `CORS_ORIGINS` | `""` | Correctly empty — one origin means no cross-origin caller to allowlist. Never `*`. |
| `LOG_LEVEL` | `info` | |
| `SESSION_COOKIE_SECURE` | on in production | **See §5 — the one thing to decide before going live.** |

Secrets come from the environment and are never baked into the image or committed (SECURITY.md §1).

## 4. Dependencies & state

- **PostgreSQL 16+**, reachable at `DATABASE_URL`. The app runs its own forward-only migrations on
  startup — no migration step to orchestrate.
- Start ordering: wait for Postgres to accept queries (`pg_isready`), not merely for the container
  to exist, or the app races the database's own start-up. The reference compose uses
  `depends_on: condition: service_healthy`.
- **The app image is stateless and owns no volume.** All state is in Postgres, so the database
  volume is the single thing to back up (BUD-S85) and the single thing to encrypt at rest.

## 5. TLS and the session cookie — decide this before going live

The session cookie is marked `Secure` in production by default, and **browsers discard a `Secure`
cookie that arrives over plain HTTP.** A hub serving budgeteer over `http://` on the LAN will
therefore appear to accept a login and then bounce straight back to the login page, with nothing
obviously wrong in the logs. Two supported shapes:

1. **Terminate TLS at a hub reverse proxy (recommended).** Change nothing here.
2. **Plain HTTP on a trusted LAN.** Set `SESSION_COOKIE_SECURE=false`. The session token then
   crosses the network in the clear and is readable by anything on that network — including a
   compromised device the household does not think of as a computer. The server logs a warning at
   every startup while this is in force.

There is no third option where plain HTTP and `Secure` both work.

## 6. Health

`GET /api/health` — **readiness, not liveness**:

- `200 {"status":"ok","db":"ok"}` — the process is up *and* the database answers.
- `503 {"status":"degraded","db":"unreachable"}` — the database did not respond within 2 s.

Public (no session needed) and detail-free. The image also declares its own `HEALTHCHECK` against
this endpoint, so `docker ps` reports honest health without hub-side configuration.

## 7. First run & operations

The image ships the operational CLIs; run them with `docker compose exec app …`:

| Command | Purpose |
| ------- | ------- |
| `node apps/api/dist/cli/create-admin.js` | Create the first admin (reads `ADMIN_USERNAME`/`ADMIN_PASSWORD` from the environment, so the password stays out of shell history). |
| `node apps/api/dist/cli/reset-password.js` | Reset a password; **revokes that user's sessions**. |
| `node apps/api/dist/cli/disable-user.js` | Disable an account; revokes its sessions. |
| `node apps/api/dist/db/restore.js <file>` | Restore a backup. **CLI-only by design — there is no HTTP import** (SEC3). |

Alternatively, first-run onboarding is available in the browser: `POST /api/auth/setup` creates the
first admin while zero users exist, and is a dead endpoint from then on.

Backups are taken with `GET /api/export` (authenticated) or `pg_dump` against the database volume.

### Restoring — two things that will bite you

Both are asserted by `scripts/validate-deploy.sh`, so this runbook cannot drift from the behaviour:

1. **A restore leaves the household with no way to log in.** The documented flow is reset-then-restore,
   and reset truncates `households` with `CASCADE` — which takes `users` (they reference it) with it.
   The backup carries the ledger, *not* accounts. So after a restore the data is all there and
   **nobody can sign in** until you run `create-admin` again. Do that before handing the box back.
2. **The backup file must be readable by the container's non-root user.** The app runs as `node`,
   and `docker cp` preserves the host file's permissions — a `600` file copied in is unreadable, and
   the restore fails with `EACCES`. `chmod 644` the backup before copying it in.

## 8. Data at rest — OPEN, owned jointly with labs-hub SPIKE-03

The hub is a portable Raspberry Pi: a **physically stealable node** carrying a household's complete
financial history. Whoever holds the SD card holds the ledger. Nothing in this repo encrypts it —
budgeteer's own posture is only that state is confined to one place.

**What budgeteer guarantees, which is what makes encryption tractable:** every byte of state lives in
the single Postgres volume (§4). The app image is stateless, writes nothing to disk, and holds no
cache — so encrypting that one volume encrypts everything. The candidate approaches (full-disk/LUKS
on the data-root, an encrypted filesystem under the volume, or Postgres-level encryption) are all hub
concerns, and none of them require an application change.

**This is not decided.** It is the one part of `BUD-S85` that cannot be settled from inside this repo,
because the mechanism, the key custody, and the unlock-on-boot story belong to labs-hub SPIKE-03.
Until that lands, a deployed hub should be treated as **unencrypted at rest** — which is a reason to
keep the Pi physically secure, and to keep backups (which are equally unencrypted) off the device.

## 9. Change policy

This file is a promise to another project. Anything in §1–§7 changing — a required variable, a port,
the health contract, the image name — is a **coordinated change with labs-hub**, announced before it
ships, not a refactor. The API paths under `/api` follow
[`06_API_CONTRACT.md`](06_API_CONTRACT.md) §5.
