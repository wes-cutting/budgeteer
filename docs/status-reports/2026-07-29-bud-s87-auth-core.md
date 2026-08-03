---
id: SR-2026-07-29-bud-s87-auth-core
type: status-report
roadmap-item: BUD-S87
---
<!--
STATUS REPORT — BUD-S87 (Auth core + login). The SECOND build slice of BUD-E13, on BUD-S86's
per-request seam. Adds real authentication (ADR-0009): users + sessions, scrypt, login/logout, a
default-deny gate that derives the request principal from the session (replacing the bootstrap
scope), first-run setup, the create-admin CLI, and the /login web flow. Closes SEC3/BUD-S38's
"unauthenticated API": the ledger is now safe to expose on the LAN, unblocking HOST=0.0.0.0.
-->

# Status Report — 2026-07-29 (BUD-S87 — Auth core + login)

| Field  | Value                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                        |
| Date   | 2026-07-29                                                                                       |
| Author | Claude (with the owner)                                                                          |
| Scope  | BUD-S87 built + `Done`; second slice of BUD-E13, per ADR-0009, validated by SPIKE-13            |

**Resume here:** **BUD-S87 is `Done` — the API is authenticated and the gate is fully green (446
Vitest + 123 e2e, typecheck + lint + docs).** Every resource route is **default-deny**: an
`onRequest` gate resolves the signed `budgeteer_session` cookie to a principal and builds the
request's scoped services from it (replacing BUD-S86's `BOOTSTRAP_SCOPE`); no/invalid session → 401
on anything but `/health` and the public auth routes. Sessions are **opaque, server-side, and
revocable** (a `sessions` row; logout deletes it). Passwords use node **scrypt** (no ARM64 native
dep). The first admin comes from `POST /auth/setup` (zero-users-only) or the `create-admin` CLI. The
web app has a `/login` page, sends credentials, and bounces to `/login` on a 401; the shell has a Log
out control. **This closes SEC3/BUD-S38** and clears the exposure blocker for `HOST=0.0.0.0`.
**Next: BUD-S88 (Roles + user management)** — admin/member enforcement, an admin UI to add/disable
members, and `reset-password`/`disable-user` CLIs (revoking sessions).

## What changed

- **Data (migration `0003-auth`):** `users` (`role` admin/member check, unique `lower(username)`,
  `disabled_at`) + `sessions` (opaque token PK, `expires_at`, FK cascade). `05_DATA_MODEL` §2 updated.
- **Auth service** ([`authService.ts`](../../apps/api/src/services/authService.ts)) — NOT scope-bound
  (it *establishes* the principal): `createUser` · `login` (enumeration-safe + timing-equalized) ·
  `resolvePrincipal` · `logout` · `countUsers`. Scrypt in [`util/password.ts`](../../apps/api/src/util/password.ts).
- **Gate + routes** ([`server.ts`](../../apps/api/src/http/server.ts)) — `@fastify/cookie` (the one
  new dep); the `onRequest` gate; `POST /auth/setup|login|logout`, `GET /auth/me`; CORS `credentials:true`.
  `req.principal` added to the Fastify type. `index.ts` always enables auth; `SESSION_SECRET`
  required in production (`config.ts`).
- **Web** — `/login` view + route (outside the shell), `credentials:"include"` + reactive 401→`/login`
  in the api client, `login/logout/setup/me` on the `Api` (real + fake), a Log out control in the shell.
- **CLI** — `npm run create-admin` (env or arg credentials; scrypt-hashed).
- **e2e** — a Playwright `globalSetup` signs in once and shares the session via `storageState`, so the
  121 existing specs run authenticated unchanged; a new `auth.spec` covers sign-in/out + the
  unauthenticated redirect **on its own isolated session** (so its logout never revokes the shared one).
- **Docs same-change:** `05_DATA_MODEL`, `06_API_CONTRACT` (auth endpoints + default-deny), `.env.example`.

## Definition of Done

- ✅ **Builds / typechecks** — `npm run typecheck` green (all workspaces + the e2e tsconfig).
- ✅ **Lint** — `npm run lint` (zero warnings) green.
- ✅ **Tests green, none skipped** — **446 Vitest + 123 e2e**. New: a 10-test API auth suite
  (default-deny · enumeration-safety · tamper-rejection · `/auth/me` · logout revocation · first-run
  setup), a 2-test `Login` unit suite, and a 2-test browser `auth.spec`.
- ✅ **Security invariants exercised** (SECURITY.md §3): default-deny at the resource level; unknown
  user and wrong password return the identical 401 (+ decoy-hash timing equalization); the cookie is
  `HttpOnly; SameSite=Strict`; logout invalidates server-side (a row delete, not just the browser).
- ✅ **Boundaries** — auth lives in the impure shell (gate + service + KDF); the domain is untouched;
  the principal enters at one chokepoint (BUD-S86's per-request factory), now sourced from the session.
- ✅ **Secrets** — `SESSION_SECRET` from env (required in prod); passwords scrypt-hashed, never logged;
  no secrets in migrations or fixtures; the e2e state file is gitignored.
- ✅ **Docs updated same-change** — data model, API contract, `.env.example`; ADR-0009 is the decision.
- ⚠ **Deferred to BUD-S89 (hardening), per the slice plan:** login throttle/lockout, session-expiry
  *tests* (the mechanism exists), and the SECURITY.md threat-model prose + property tests. Setup's
  zero-users gate is check-then-insert (a narrow first-run race) — hardened in S89.
- ⚠ **Deploy-profile note for BUD-S83:** `secureCookie` = `APP_ENV === "production"`. A prod hub
  serving plain HTTP on the LAN would drop the `Secure` cookie and break login — serve TLS (reverse
  proxy) or make it configurable in the deploy profile. Not an S87 blocker.
- ⚠ **Format** — one pre-existing warning (`scripts/capture-demo-assets.ts`), untouched here.

**Test delta:** 434 Vitest + 121 e2e → **446 Vitest + 123 e2e** (+12 Vitest, +2 e2e).

**Commit:** `feat(api,web): authentication — users/sessions, default-deny gate, login flow (BUD-S87); closes SEC3`

## Next-session kickoff prompt

> Build **BUD-S88 (Roles + user management)** — the third slice of BUD-E13, per
> [ADR-0009](../adr/ADR-0009-authentication-household-scoping.md) §7–§8. Enforce **admin/member**:
> gate user-management routes to admins (member → 403), using `req.principal.role`. Add an admin UI
> to **add** and **disable** members and **reset** passwords, and the `reset-password` / `disable-user`
> CLIs — all of which **revoke the target's sessions** (delete their `sessions` rows) so a disabled or
> reset account is logged out everywhere (SECURITY.md §3). Keep the gate green (446 Vitest + 123 e2e as
> the floor) and add role-enforcement + revocation tests. No new deps expected.
