---
id: SR-2026-07-31-bud-s89-login-hardening
type: status-report
roadmap-item: BUD-S89
---
<!--
STATUS REPORT — BUD-S89 (Login hardening + threat-model tests). The FINAL slice of BUD-E13. Adds a
brute-force login throttle, proves session expiry, adds last-admin protection, and lands the
security-invariant tests + SECURITY.md prose. Flips ADR-0009 → Accepted and marks BUD-E13 Done,
clearing the last exposure blocker for the BUD-E14 hub deploy (HOST=0.0.0.0 now safe).
-->

# Status Report — 2026-07-31 (BUD-S89 — Login hardening + threat-model tests)

| Field  | Value                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                   |
| Date   | 2026-07-31                                                                                 |
| Author | Claude (with the owner)                                                                    |
| Scope  | BUD-S89 built + `Done`; **completes BUD-E13**; ADR-0009 → Accepted                          |

**Resume here:** **BUD-S89 is `Done` — and with it BUD-E13 (authentication) is complete.** The login
route now has a **brute-force throttle** (in-memory, keyed on `(IP, username)` → `429` after 5 fails
for 15 min; a success clears it; a different source is never collateral-locked). **Session expiry** is
proven end-to-end via the injected clock (an expired session → 401 and its row is cleaned up).
**Last-admin protection** blocks disabling the final active admin (service-level, so the CLI path is
covered too; the route already blocked self-disable). The **security-invariant tests** cover
default-deny, enumeration-safety, revocation, expiry, last-admin, and **cross-household not-found**
(a second household's user is 404, never 403/200). **ADR-0009 → Accepted**; SECURITY.md §3 rewritten
to describe the shipped posture. **This clears the last exposure blocker — `BUD-E14` (hub deploy) can
now proceed to `HOST=0.0.0.0`.** **Next: BUD-E14** — the build fronts (`BUD-S81` Dockerfile, `BUD-S83`
prod config/deploy contract, `BUD-S84` GHCR CI, `BUD-S85` backup/at-rest) are unblocked; `BUD-S82`
(Postgres) is already de-risked by SPIKE-12.

## What changed

- **Throttle** ([server.ts](../../apps/api/src/http/server.ts)) — `POST /auth/login` gains an
  in-memory `(IP, username)` failure counter → `429` on lockout. Enumeration-safe (locks regardless
  of whether the account exists); no global account-lockout (keyed on the pair).
- **Last-admin protection** ([authService.ts](../../apps/api/src/services/authService.ts)) —
  `setDisabled` refuses to disable the last active admin in a household (`ValidationError` → 400 at
  the route).
- **Docs** — `SECURITY.md` §3 rewritten (shipped auth posture + the accepted first-run-setup race
  note); `06_API_CONTRACT` login gains `429`; **ADR-0009 → Accepted**, index updated.

## Definition of Done

- ✅ **Builds / typechecks / lint** — green across workspaces + the e2e tsconfig.
- ✅ **Tests green, none skipped** — **459 Vitest + 124 e2e**. New: 4 hardening tests (throttle
  lockout + non-collateral; session expiry + row cleanup; last-admin protection incl. the two-admin
  allowed case; cross-household not-found).
- ✅ **Threat-model invariants asserted** (SECURITY.md §3) — default-deny · enumeration-safety ·
  revocation on disable/reset · session expiry · brute-force throttle · last-admin · cross-household
  scoping returns not-found (existence doesn't leak).
- ✅ **Docs updated same-change** — SECURITY.md, API contract, ADR-0009 Accepted.
- ✅ **Secrets / boundaries** — unchanged from S87/S88; auth in the impure shell, no secrets logged.
- ⚠ **Observed intermittent test flake (pre-existing, not S89):** one full-suite run showed 1
  unidentified failure that did not reproduce on three subsequent runs; the S89 auth tests are stable
  (19/19 ×3). Consistent with this repo's documented clock/date-sensitivity (BUD-S28), amplified at a
  month-end date (2026-07-31). **Recommend a follow-up to hunt the date-sensitive test** (out of S89
  scope — it is not in the auth code).
- ⚠ **Throttle is in-memory** (resets on restart) — intentional for a single-container LAN service; a
  multi-instance deploy would need a shared store. Noted for BUD-E14 if the topology ever changes.
- ⚠ **Format** — one pre-existing warning (`scripts/capture-demo-assets.ts`), untouched.

**Test delta:** 455 Vitest + 124 e2e → **459 Vitest + 124 e2e** (+4 Vitest).

**Commit:** `feat(api): login throttle, session-expiry + last-admin guards, threat-model tests (BUD-S89); ADR-0009 Accepted, BUD-E13 done`

## Next-session kickoff prompt

> **BUD-E13 (authentication) is complete and ADR-0009 is Accepted — the exposure blocker is cleared.**
> Resume **BUD-E14 (hub deployment readiness)**. The build fronts are now unblocked; a sensible order:
> **BUD-S81** (multi-stage ARM64 Dockerfile — Fastify serves the built web static, per
> [ADR-0008](../adr/ADR-0008-containerized-production-runtime.md)), then **BUD-S82** (production
> Postgres + `/health` DB-readiness — already de-risked by [SPIKE-12](../spikes/12-postgres-production-validation.md)),
> **BUD-S83** (prod config profile: `HOST=0.0.0.0` now safe · `SESSION_SECRET` required · **TLS/Secure-cookie
> decision** flagged in the BUD-S87 report · publish the §5 deploy contract), **BUD-S84** (GHCR CI),
> **BUD-S85** (at-rest encryption + backup/restore on Postgres). Keep the gate green (459 Vitest + 124
> e2e as the floor). Also worth a quick follow-up: chase the pre-existing intermittent Vitest flake.
