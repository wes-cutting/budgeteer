---
type: spike
id: SPIKE-13
roadmap-item: [BUD-E13, SPIKE-13]
status: Done
---
<!--
SPIKE REPORT — findings only. The throwaway prover lives at /spikes/13-auth-seam/seam.ts
(eslint- and prettier-ignored) and is discarded once BUD-E13's first slice absorbs the pattern.
Reality-before-paper for BUD-E13 shape A; feeds the auth/tenancy ADR (next).
-->

# SPIKE-13 — auth vertical seam (BUD-E13 shape A)

| Field    | Value                                                                 |
| -------- | --------------------------------------------------------------------- |
| Status   | Done                                                                   |
| Date     | 2026-07-29                                                             |
| Owner    | Wesley Cutting + agent                                                 |
| Question | Can a request-derived principal `{userId, householdId, role}` scope a query by the caller's household (replacing the `DEFAULT_HOUSEHOLD_ID` constant), gated by a session, with password hashing — proven on one slice, on the dev PGlite path, **without new dependencies** and without polluting the pure domain? |
| De-risks | `BUD-E13` (the auth epic); informs the forthcoming auth/tenancy ADR |
| Prover   | [`/spikes/13-auth-seam/seam.ts`](../../spikes/13-auth-seam/seam.ts) (throwaway; Fastify `inject`, no ports) |

## 1. Why

BUD-E13's real work is not the login form — it is the **seam**. Today `household_id` scoping is
structurally present but authenticates nobody: every service reaches for the compile-time
`DEFAULT_HOUSEHOLD_ID` constant ([`constants.ts`](../../apps/api/src/constants.ts)). Making scoping
*mean* something requires threading a per-request principal from an auth hook into the query layer.
Before an ADR commits to a mechanism, prove the mechanism runs — especially on the **PGlite** dev
path, and without dragging in a native/wasm auth dependency onto a lean self-hosted ARM64 box.

## 2. What was built (throwaway)

A minimal Fastify app on an in-memory PGlite store with **two** households (A: 2 accounts + an
admin user; B: 1 account), exercised via `inject`:

- **KDF:** node's built-in `crypto.scryptSync` (memory-hard, SECURITY.md §3), self-describing
  `scrypt$N$r$p$salt$hash` format, constant-time compare (`timingSafeEqual`). **No dependency.**
- **Session:** an HMAC-signed stateless cookie (`sid=<userId>.<hmac>`), `HttpOnly; SameSite=Strict`.
- **Gate:** a `preHandler` on an encapsulated plugin verifies the cookie → loads the user → sets
  `req.principal`; missing/invalid → 401 (default-deny). `/login` sits outside the gate.
- **Seam:** the protected `GET /accounts` calls `listAccounts(db, principal.householdId)` — the
  household is a **parameter derived from the principal**, not the constant.

## 3. Findings — all green (11/11)

| Property (SECURITY.md §3) | Result |
| ------------------------- | ------ |
| **Default-deny** — no cookie → 401 | ✅ |
| **Session** — login sets an `HttpOnly; SameSite` cookie; authed request → 200 | ✅ |
| **Tamper-proof** — a forged cookie → 401 (HMAC verify + constant-time) | ✅ |
| **Principal-derived scoping** — the authed member sees exactly their household's 2 rows | ✅ |
| **Cross-household exclusion** — household B's row never appears for an A member | ✅ |
| **Enumeration-safe** — unknown user and wrong password return the **identical** 401 (+ a decoy hash on the missing-user path to equalize timing) | ✅ |
| **KDF** — scrypt hash/verify round-trips; wrong password rejected | ✅ |

Runs on PGlite with zero new deps. Domain purity untouched (all auth lives in the impure shell:
the hook, the session helpers, the KDF; the "service" call just takes a `householdId` argument).

## 4. Answer & recommendations for the ADR

**Yes — the seam is proven.** Recommendations to carry into the auth/tenancy ADR (decisions, not
yet decided here):

1. **The seam pattern:** thread `householdId` (and `userId`/`role` for authz + audit) from the
   principal into service calls. Two concrete shapes to choose in the ADR: **(a)** add the scope
   as an explicit parameter on service methods (most transparent; a large but mechanical signature
   change across ~15 services), or **(b)** a per-request service factory bound to the principal
   (smaller call-site churn; constructs services per request). The spike used (a); the ADR should
   pick with the full service surface in view.
2. **KDF = node `scrypt`** — memory-hard, zero-dep, SECURITY.md-compliant. Avoids `argon2` (native
   build) / wasm on ARM64. Store params in the hash string for future cost bumps.
3. **Session = HMAC-signed (or encrypted) cookie**, `HttpOnly; SameSite=Strict; Secure`
   (same-origin per ADR-0008's single image). **Open for the ADR:** hand-rolled `node:crypto` vs a
   vetted lib (`@fastify/secure-session`/`@fastify/cookie`) — lean toward the vetted lib for expiry,
   rotation, and CSRF ergonomics; add **expiry + a rotating secret** (the spike omitted both) and
   an env-supplied `SESSION_SECRET` (folds into the BUD-S83 deploy contract).
4. **Enumeration-safety is cheap and must stay** — uniform 401 + timing equalization, as shown.
5. **Not covered (own scope):** CSRF stance, session expiry/rotation, rate-limiting/lockout, the
   real migration (`users` + `household_members` or `users.household_id`), admin/member enforcement,
   the CLI reset command, and the login UI. These are ADR + slice work, not spike risks.

## 5. Teardown

The prover is throwaway (eslint- + prettier-ignored); it is deleted once BUD-E13's first slice
absorbs the pattern (the BUD-S27/EH6 precedent — findings persist here, code does not).
