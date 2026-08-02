---
type: adr
id: ADR-0009
status: Accepted
---
<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. The auth MECHANISM is validated by SPIKE-13; the full decision
(schema · server-side sessions · roles · CLI) is validated when BUD-E13's first slice lands, so
this stays Proposed until then. Refines ADR-0002's multi-household note; resolves SEC3/BUD-S38.
-->

# ADR-0009: Authentication & household scoping — per-user auth, principal-scoped queries, no in-app multi-tenancy

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Accepted                                                          |
| Date          | 2026-07-29                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | Mechanism by [`SPIKE-13`](../spikes/13-auth-seam.md); **fully implemented + validated** by BUD-E13 slices **BUD-S86** (principal seam) · **BUD-S87** (auth core + login) · **BUD-S88** (roles + user mgmt) · **BUD-S89** (throttle · session expiry · last-admin · threat-model tests). Gate-green (455 Vitest + 124 e2e). |
| Refines       | [`ADR-0002`](ADR-0002-datastore.md) (its "future multi-household → RLS" note — this ADR chooses container-per-household instead) |
| Resolves      | `SEC3` / `BUD-S38` (the unauthenticated-API finding); unblocks `HOST=0.0.0.0` for `BUD-E14`/[ADR-0008](ADR-0008-containerized-production-runtime.md) |
| Context       | [`BUD-E13`](../03_ROADMAP-v2.md) discovery (2026-07-29): shape A · admin/member · CLI reset |

## Context

Budgeteer has **no authentication**: the API binds loopback because anything that reaches the
port can read/write the whole ledger (SECURITY.md §3, EH11). Deploying on labs-hub
([`BUD-E14`](../03_ROADMAP-v2.md)) means serving on the LAN — the documented trigger to build auth.

The data is **already structurally household-scoped** (every table carries `household_id`;
ADR-0002 "designed toward"), but the value is the compile-time `DEFAULT_HOUSEHOLD_ID` constant, so
it authenticates nobody. Discovery (2026-07-29) fixed the shape: **A — one household, many member
users**; multi-household, if ever, via a **separate container per household** (process/data
isolation at the container boundary; ADR-0008 makes this cheap), **not** in-app row-level security.
Roles are **admin + member**; password recovery is **CLI/admin** (no SMTP on a CGNAT LAN box).

[`SPIKE-13`](../spikes/13-auth-seam.md) proved the seam end-to-end with zero new dependencies.

## Decision

**Add per-user authentication and make household scoping principal-derived. Keep tenancy in-process
single-household; isolate multiple households (if ever) by running separate containers.**

1. **Tenancy = shape A, no in-app RLS.** One household per instance; users belong to it. `household_id`
   stays on every table (a future flip stays additive), but multi-household isolation is achieved by
   **one container + one Postgres per household** (ADR-0008), not Postgres RLS. This refines
   ADR-0002's forward note (RLS is explicitly *not* adopted).

2. **Principal-scoped queries via a per-request service factory.** Services are constructed
   **per request**, bound to the authenticated `principal = {userId, householdId, role}`
   (from the session), replacing the once-at-boot construction. Route handlers call
   `req.services.*`; **`DEFAULT_HOUSEHOLD_ID` is removed from the request path** (it survives only
   as a bootstrap/seed constant, unreachable from a request). Chosen over threading an explicit
   `householdId` param through ~15 services' methods: the factory is a **single chokepoint** where
   the household enters, the type system can make a service **unconstructable without a principal**
   (structural default-deny), and service-method signatures — and their unit tests + the DTO
   contract — stay stable. Cross-household access returns **not-found**, never forbidden
   (SECURITY.md §3).

3. **Passwords = node `crypto.scrypt`** (memory-hard, SECURITY.md §3), self-describing
   `scrypt$N$r$p$salt$hash` (params stored for future cost bumps), constant-time compare. **No
   `argon2`/native/wasm dependency** on the ARM64 box (validated in SPIKE-13).

4. **Sessions = opaque, server-side, revocable.** A new `sessions` table (`id`, `user_id`,
   `created_at`, `expires_at`); the cookie carries only a **signed opaque session id**
   (`@fastify/cookie` — the one new runtime dep), `HttpOnly; SameSite=Strict; Secure; Path=/`. Each
   request looks the session up (indexed, same pool). Chosen over a **stateless** encrypted cookie
   because SECURITY.md §3 requires invalidating sessions **on password reset and on account
   disable** — trivial as row deletes here, awkward with a stateless cookie. Expiry via
   `expires_at`; the signing secret is env-supplied (`SESSION_SECRET`, folded into the `BUD-S83`
   deploy contract; missing/short → fail loud at startup).

5. **CSRF = `SameSite=Strict` + same-origin.** ADR-0008's single image serves web + API on one
   origin, so `SameSite=Strict` is the primary CSRF control; no double-submit token in V1 (noted as
   the follow-up if the origin model ever splits). Accept the SameSite=Strict caveat that a
   cold external → app link needs one in-app navigation to attach the cookie (fine for a bookmarked
   LAN app).

6. **Schema (migration `0003-auth`, forward-only, Kysely Migrator — BUD-S30).**
   `users` (`id`, `username` unique-lowercased, `password_hash`, `household_id` FK, `role` ∈
   {`admin`,`member`} via check, `created_at`, `disabled_at` nullable) + `sessions` (above).
   Membership is `users.household_id` (shape A → one household per user; no join table until a user
   must span households, which container-per-household makes unlikely). The migration creates
   tables only — **no passwords in migrations**; the first admin is created by CLI (§8).

7. **Authorization: default-deny, admin/member.** Members read/write the shared household ledger.
   **Admin-only:** user management (create/disable users, reset passwords). Member hitting an
   admin route → **403** (within-household, so existence isn't secret). Backup/restore stays
   **CLI-only** regardless (SEC3). Every resource route is behind the session gate; no route is
   public except `POST /login` (and `/health`).

8. **CLI for bootstrap & recovery (no SMTP).** `create-admin` (bootstrap the first user),
   `reset-password` (admin/CLI sets a new password → deletes that user's sessions), `disable-user`
   (sets `disabled_at` → deletes sessions). Run on the box (`npm run` under `apps/api`).

9. **Login hardening.** Enumeration-safe (uniform 401 + timing equalization, per SPIKE-13) and a
   basic **per-username/IP login throttle** on `POST /login` (the one brute-forceable surface) —
   deferred to the slice, sized small, not a mechanism risk.

10. **Client.** A `/login` view; the SPA sends the cookie automatically (same-origin, httpOnly →
    JS never reads it); a 401 from any read redirects to `/login`; a logout control deletes the
    session. `api.ts` uses `credentials: "same-origin"`.

## Consequences

### Positive
- Closes SEC3: the ledger is default-deny, principal-scoped, safe to expose on the LAN → unblocks
  `HOST=0.0.0.0` and the `BUD-E14` deploy.
- Zero-to-one new runtime dep (`@fastify/cookie`); scrypt + sessions ride the platform + Postgres we
  already run. Nothing speculative (no RLS, no SMTP, no token infra).
- The per-request factory makes "unscoped query" a **construction-time impossibility**, not a
  review-time catch.

### Negative / cost
- Per-request service construction (thin closures over `db` — cheap, but no longer singletons).
- A broad but mechanical change: every route handler moves from a shared `services` to
  `req.services`; every service drops the `DEFAULT_HOUSEHOLD_ID` constant for the injected scope.
- Server-side sessions add a `sessions` table + a per-request lookup (indexed; negligible).
- New auth surface to test as a **security property** (default-deny, cross-household not-found,
  enumeration-safety, revocation on reset/disable) — property/e2e tests, ceremony scaled up.

### Neutral
- `DEFAULT_HOUSEHOLD_ID` persists as a seed/bootstrap constant only.
- Multi-household remains *possible* (the column is universal) but is an ops concern
  (another container), not app code.

## Alternatives considered

- **In-app multi-tenant isolation via Postgres RLS (ADR-0002's floated future).** Rejected for this
  deployment: it builds isolation machinery for tenants that don't exist (deploy Non-goal §8), adds
  a PGlite-RLS compatibility risk, and container-per-household gives *stronger* isolation for free.
- **Explicit `householdId` param on every service method.** Rejected: more transparent per-call but
  large signature churn across ~15 services and their tests/contract, and no single chokepoint —
  the factory is both less churn and more auditable.
- **Stateless encrypted-cookie sessions (`@fastify/secure-session`).** Rejected: simplest, but
  can't satisfy SECURITY.md §3's per-session revocation on reset/disable without either a per-user
  token-version DB check (no longer stateless) or global key rotation (logs everyone out).
- **`argon2` KDF.** Fine algorithm, but a native/wasm build on ARM64 for no benefit over scrypt,
  which is in the standard library and SECURITY.md-compliant.
- **Email-based password reset.** Rejected in discovery: needs an SMTP path off a CGNAT LAN box;
  CLI/admin reset fits a self-hosted appliance.

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
- Refines: [`ADR-0002`](ADR-0002-datastore.md) (multi-household approach: container-per-household, not RLS).
