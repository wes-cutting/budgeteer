---
type: status-report
roadmap-item: [BUD-S81, BUD-S82, BUD-S83, BUD-S84, BUD-S85]
---
<!--
STATUS REPORT — BUD-S81..S85, the build fronts (B–F) of BUD-E14 (hub deployment readiness).
Packages budgeteer as a single ARM64 image on Postgres, makes /health a real readiness probe,
publishes the deploy contract labs-hub LH-S3 consumes, and adds the GHCR publish workflow.
Flips ADR-0008 → Accepted. The headline discovery: ADR-0008's one-origin design collided with
the SPA's own routes, so every API path moved under /api.
-->

# Status Report — 2026-08-01 (BUD-S81–S85, hub deployment)

| Field  | Value                                                                 |
| ------ | --------------------------------------------------------------------- |
| Status | Snapshot                                                               |
| Date   | 2026-08-01                                                             |
| Author | Wesley Cutting + agent                                                 |
| Scope  | `BUD-E14` fronts B–F: containerization, production Postgres + readiness, prod config + deploy contract, GHCR CI, backup/restore. Plus the long-standing Vitest flake. |

**Resume here:** budgeteer is **deployable**. A single 82 MB `linux/arm64` image serves the SPA and
the API from one process, runs against real PostgreSQL 16, and passes a 24-check end-to-end
deployment harness (`./scripts/validate-deploy.sh`). The [deploy contract](../DEPLOY_CONTRACT.md) is
published, so **labs-hub LH-S3 is unblocked**. The gate is green: **480 Vitest + 124 e2e**, and the
intermittent `perf.test.ts` flake is fixed at the root. Two things are genuinely not done, both
visible below: **at-rest encryption** (belongs to labs-hub SPIKE-03 — treat a deployed hub as
unencrypted) and a **first real tag push** to exercise the GHCR workflow, which has never run.
One decision the owner must make before going live: **TLS, or `SESSION_COOKIE_SECURE=false`**
([contract §5](../DEPLOY_CONTRACT.md)).

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| **The `/api` prefix** — every API path moved | Building the image falsified ADR-0008's one-origin assumption: **7 SPA client routes are spelled exactly like API paths** (`/accounts`, `/envelopes`, `/templates`, `/recurring`, `/users`, + two `:id` forms), so a browser refresh on the Accounts page was answered by the account-list endpoint — JSON instead of the app. Ordering can't fix identical paths. **Owner chose** namespacing the API over content negotiation or moving the SPA. Applies in every environment, so tests exercise what ships. | `BUD-S81` · [ADR-0008 §1](../adr/ADR-0008-containerized-production-runtime.md) |
| Multi-stage ARM64 image | `node:22-bookworm-slim`, non-root `node` user, **82 MB**. esbuild bundles the API + domain to ESM (`tsx` can't be the production runtime); third-party deps stay external and lockfile-installed. Ships the operational CLIs. | `BUD-S81` · [`Dockerfile`](../../Dockerfile) |
| Fastify serves the SPA | `@fastify/static` + SPA fallback. The static surface is **deliberately public** — the login page must load without a session — scoped by *route* (the static wildcard or no match), never by path matching, and `/api/**` is excluded outright so an unknown API path still 401s. | `BUD-S81` |
| PGlite → devDependency | ADR-0008 §2 said "dev/test only"; now literally true. −26 MB (a third of the image). Consequence: `DATABASE_URL` is **required** in production and startup fails loudly without it — better than silently serving a household ledger from a store that empties on restart. | `BUD-S81` |
| `/api/health` is a readiness probe | `200 {status,db}` / **`503`** when the database doesn't answer within 2 s, closing [SPIKE-12](../spikes/12-postgres-production-validation.md)'s finding #2. The timeout is the point: a wedged Postgres accepts the connection and never replies, so an unbounded probe would hang instead of reporting unhealthy. | `BUD-S82` |
| Deployment harness + reference compose | [`deploy/compose.yaml`](../../deploy/compose.yaml) (what LH-S3 consumes) and `scripts/validate-deploy.sh` — **24 checks green** against real PostgreSQL 16 (arm64): readiness, SPA deep-links, default-deny, a real session, writes verified *in Postgres*, backup/restore, restart survival. | `BUD-S82`/`S85` |
| Production config profile | `SESSION_SECRET` **and** `DATABASE_URL` required in production; `HOST=0.0.0.0` is now the image default (safe since `BUD-E13`) and its EH11 warning is retired. Graceful SIGTERM/SIGINT shutdown — as PID 1, Node gets no default handlers, so `docker stop` was a 10 s wait then SIGKILL mid-request. | `BUD-S83` |
| **The TLS/Secure-cookie decision, resolved** | `BUD-S87` flagged this for here. New `SESSION_COOKIE_SECURE` (defaults on in production; startup **warns** when off). Without it, a TLS-less LAN hub accepts the login, sets a cookie the browser discards, and bounces the user back to the login page with nothing in the logs. | `BUD-S83` · [contract §5](../DEPLOY_CONTRACT.md) |
| **Deploy contract published** | [`docs/DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md) — image, ports, env, dependencies, health, first-run/ops runbook, and a change policy making it a coordinated surface. Closes initiative §9's last open item. | `BUD-S83` |
| GHCR publish workflow | [`publish-image.yml`](../../.github/workflows/publish-image.yml): tag-triggered QEMU arm64 build → GHCR with **signed build provenance**; `latest` only follows a real semver tag. The gate's build step now covers the API too. | `BUD-S84` |
| Backup/restore proven **on Postgres** | SPIKE-09 proved the round-trip on PGlite only. Now export → reset → restore on real `pg`, which surfaced **two runbook traps** (§4). | `BUD-S85` |
| **The Vitest flake, fixed at the root** | `perf.test.ts`'s `measure()` indexed `floor(n*0.95)` = element 19 of 20 — it reported the **maximum** while asserting a **p95** budget (07_NFR §1). One GC pause in twenty runs failed the suite; the cold first iteration was the usual culprit. Now nearest-rank p95 + 3 warm-up iterations. Measured p95 and max now differ, as they should. | watch item since 2026-07-03 |

## 2. Definition of Done — current state

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ | Initiative §6: **B** image builds+runs ✅ · **C** Postgres + green health ✅ · **D** prod config validated + contract published ✅ · **E** GHCR job exists ⚠ (never executed — §4) · **F** backup ✅ / encryption ❌ (§4). 24/24 harness checks. |
| Gate green (types/lint/format/tests/e2e/build) | ✅ | `typecheck` ✅ · `lint` ✅ · `format` ✅ **fully clean for the first time** (the long-carried `capture-demo-assets.ts` warning is gone — that file was edited here anyway) · `docs:check` ✅ 164/164 · **480 Vitest** ✅ · **124 e2e** ✅ · build (web **and** API) ✅ |
| Usable end-to-end (data→API→UI) | ✅ | The harness drives the deployed container: SPA loads, login issues a session, a write lands in Postgres and is read back with `psql`, and it survives a restart. |
| Docs updated in same change | ✅ | ADR-0008 (→ **Accepted**, with the falsified assumption recorded) · `06_API_CONTRACT` (the `/api` prefix, readiness, and a **stale "Authz: none yet"** bullet corrected) · new `DEPLOY_CONTRACT.md` · initiative §5/§9 closed · `.env.example` · roadmap. |
| Security (input/authz/secrets) | ✅ | Default-deny **verified against the running container**, not just in unit tests: anonymous `/api/accounts` and `/api/export` both 401. The static exemption is route-scoped and pinned by tests that would fail if it ever widened to an API path. `.dockerignore` is **deny-by-default** — the repo holds the owner's real ledger and `.env`, and this image gets published, so a new confidential file is excluded automatically rather than leaking until someone adds a rule. Secrets from env only; the harness generates throwaway ones and never writes them to disk. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 459 | **480** | **+21** |
| E2E | 124 | **124** | 0 |
| Deployment harness (new surface) | — | **24 checks** | +24 |

New Vitest coverage (7 + 3 + 10 + 1 = +21): `static.test.ts` (**7** — SPA serving and its interaction
with the gate, including the client-route collision regression and proof that the static exemption
never reaches an API path), `health.test.ts` (**3** — readiness, including **503 once the store is
gone**), `config.test.ts` (**+10** — the production profile, `SESSION_COOKIE_SECURE`,
`WEB_STATIC_ROOT`), `auth.test.ts` (**+1** — `Secure` is set when `secureCookie` is on, plus a new
not-`Secure`-by-default assertion on the existing cookie test).

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| **At-rest encryption — not done** | The mechanism, key custody, and unlock-on-boot belong to **labs-hub SPIKE-03**; it cannot be decided from inside this repo. budgeteer's side is ready: all state is in one Postgres volume, so encrypting that volume encrypts everything, and no app change is needed. **Until then a deployed hub is unencrypted at rest** — keep the Pi physically secure and backups off the device. | Owner + labs-hub SPIKE-03 |
| **The GHCR workflow has never run** | Tag-triggered, and the repo has **no tags at all**. The YAML parses and the `docker build --platform linux/arm64` it wraps is proven locally, but QEMU cross-build, GHCR auth, and provenance attestation are **unexercised**. Reviewing it afterwards caught one real bug — `attest-build-provenance` needs `attestations: write` as well as `id-token: write`, and only the latter was set, so the attest step would have failed. Fixed, still unrun. After the first push, **check the package's visibility**: a new GHCR package is not public by default, so the hub needs either the package made public or a `read:packages` PAT to `docker login ghcr.io`. | Owner — push a `v*` tag, watch the run, then set package visibility / hub pull credentials |
| **TLS vs `SESSION_COOKIE_SECURE`** | A decision only the deployment can make. Terminate TLS at a hub proxy (recommended, change nothing), or set `SESSION_COOKIE_SECURE=false` and accept that the session token crosses the LAN in the clear. There is no third option where plain HTTP and `Secure` both work. | Owner, before going live |
| **A restore leaves nobody able to log in** | `reset` truncates `households` `CASCADE`, which takes `users` with it, and the backup carries the ledger but **not accounts**. So a restored box has all its data and no way in until `create-admin` runs again. Asserted by the harness and written into [contract §7](../DEPLOY_CONTRACT.md) so the runbook can't drift — but it is a sharp edge, and making `/export` carry users (or the restore re-seed an admin) is a real follow-up. | Tracked; owner's call |
| **Backup file permissions on restore** | The container runs as non-root `node` and `docker cp` preserves host permissions, so a `600` backup copies in unreadable (`EACCES`). `chmod 644` first. In the harness and contract §7. | Documented |
| **Node 22 in the image vs Node 20 in dev/CI** | The image runs the active LTS deliberately: Node 20 went EOL in April 2026 and this serves a household ledger on the LAN. The divergence is real but narrow — the harness exercises the image on Node 22 end-to-end. Aligning dev/CI to 22 is the tidy follow-up. | Follow-up |

## 5. Outstanding & next steps

- **`BUD-E14` is functionally complete except encryption.** Hand [`DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md) to labs-hub and let LH-S3 proceed.
- **Push a real tag** to prove the GHCR path, then pin the hub to that digest.
- **labs-hub SPIKE-03** closes the encryption half of `BUD-S85`.
- Consider whether `/export` should include user accounts, given the restore trap above.
- Optional tidy-up: move dev/CI to Node 22 so every surface runs one runtime.

## 6. Commands & gotchas (cold-start)

```sh
npm install
npm run typecheck && npm run lint && npm run format && npm run docs:check
npx vitest run                 # 480
npx playwright test            # 124 — needs :3001 and :5173 free
./scripts/validate-deploy.sh   # 24 deployment checks; needs a container runtime
```

- **The deploy harness needs `colima` running** (`colima start`) — Docker Desktop is absent on this
  machine. It publishes on **:3099**, not :3001, because the owner's dev stack lives there and
  respawns itself. It tears down its containers *and volume* on exit, always.
- **e2e needs :3001 and :5173 genuinely free** (`lsof -iTCP:3001 -sTCP:LISTEN`). Stopping the npm
  wrapper can leave an orphaned node child holding the port (K24).
- **Stop colima before running e2e** (`colima stop`) — not just the deploy harness, the **VM itself**.
  This was measured, repeatedly: with colima up, full e2e runs took 7.5–34.8 min and each one failed
  a *different* single spec on a 30 s `locator.click` timeout (transactions, then templates, then
  analysis, then two a11y scans); every one of them passed in isolation in seconds. With colima
  stopped: **5.8 min, 124/124**. The idle VM is enough to starve Playwright's timing assumptions.
  So a lone e2e timeout failure is a load signal, not a regression — check what else is running
  before you go looking for a bug in the app.
- The API is at **`/api`** now. `VITE_API_BASE_URL` is the **origin only** — the client appends
  `/api` itself, so existing `.env` files keep working unchanged.

## 7. Next-session kickoff prompt

```text
You are resuming budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST file in docs/status-reports/ (2026-08-01, BUD-S81–S85) — its "Resume here" has state.
- Read docs/03_ROADMAP-v2.md — BUD-E14's build fronts are Done; BUD-S85's encryption half is open.

budgeteer is now deployable: one 82 MB ARM64 image serving the SPA + API on one origin against
PostgreSQL 16, with docs/DEPLOY_CONTRACT.md published and labs-hub LH-S3 unblocked. Gate: 480
Vitest + 124 e2e, plus ./scripts/validate-deploy.sh (24 checks, needs `colima start`).

YOUR ONE ITEM THIS SESSION: fix the restore lockout (BUD-S90, see the report's §4/§5).
A restore currently leaves the household with its whole ledger and NOBODY able to log in,
because `db/reset.ts` truncates `households` CASCADE and `users.household_id` references it,
while the backup carries no accounts. The likely fix is small and targeted: stop truncating
`households` in reset (migrate re-inserts it anyway, and restoreService already upserts that
row and already ignores it in its emptiness check), so user accounts survive reset→restore.
Confirm that reading before you change anything. Add a test pinning it, and update
DEPLOY_CONTRACT §7 — which currently documents the trap and must stop doing so once fixed.

Build ONLY that, then write the status report and STOP for review — do not continue into the
items below even if they look quick and you have context left (CLAUDE.md; 00_WAYS_OF_WORKING §9).

For CONTEXT only, not for this session — still open on BUD-E14:
- The GHCR workflow has never run; it needs a real v* tag push (and the published package made
  pullable by the hub).
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).

Watch out for: run `colima stop` before e2e — an idle colima VM alone makes full e2e runs take
7.5-34.8 min and flake a random spec on 30s timeouts; stopped, it is 5.8 min and 124/124.
The API lives under /api as of BUD-S81.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change; and at the end, leave the
project handoff-ready with the next-session kickoff prompt in the status report.
```
