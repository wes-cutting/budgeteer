---
id: SR-2026-07-31-bud-s88-roles-user-management
type: status-report
roadmap-item: BUD-S88
---
<!--
STATUS REPORT — BUD-S88 (Roles + user management). The THIRD build slice of BUD-E13, on the
BUD-S87 auth core. Adds admin/member enforcement, an admin UI to add/disable members and reset
passwords, and the reset-password/disable-user CLIs — all of which REVOKE the target's sessions
(a row delete) so a disabled or reset account is logged out everywhere (SECURITY.md §3).
-->

# Status Report — 2026-07-31 (BUD-S88 — Roles + user management)

| Field  | Value                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                   |
| Date   | 2026-07-31                                                                                 |
| Author | Claude (with the owner)                                                                    |
| Scope  | BUD-S88 built + `Done`; third slice of BUD-E13, per ADR-0009 §7–§8                         |

**Resume here:** **BUD-S88 is `Done` — admin/member roles are enforced and gate-green (455 Vitest +
124 e2e, typecheck + lint + docs).** Admins manage users in their household: `GET/POST /users`,
`POST /users/:id/disable|enable|reset-password` — all **admin-only** (a member gets `403`). **Disable
and reset revoke the target's sessions** (a `sessions` row delete), so a disabled or password-reset
user is logged out everywhere on their next request (SECURITY.md §3). An admin **cannot disable their
own account** (self-lockout guard). The web app has an admin **Users** page (add member · disable /
enable · reset password) and the sidebar shows the **Users** entry only to admins (from `me()`).
The `reset-password` and `disable-user` CLIs do the same out of band. **Next: BUD-S89 (Login
hardening + threat-model tests)** — throttle/lockout, session-expiry tests, the security-invariant
property tests, and the SECURITY.md prose; it flips ADR-0009 → Accepted and completes BUD-E13.

## What changed

- **`authService`** ([authService.ts](../../apps/api/src/services/authService.ts)) — `listUsers` ·
  `setDisabled` · `resetPassword` · `userIdByUsername`, all **household-scoped**; disable/reset delete
  the target's `sessions` rows. New `UserView` (never the hash), exported via `@budgeteer/api/contract`.
- **Routes** ([server.ts](../../apps/api/src/http/server.ts)) — `GET/POST /users`,
  `/users/:id/disable|enable|reset-password`, each gated to `req.principal.role === "admin"` (403
  otherwise); self-disable → 400; unknown user → 404.
- **CLIs** — `npm run reset-password` · `disable-user` (env or arg; both revoke sessions).
- **Web** — a `/users` admin page ([UsersAdmin.tsx](../../apps/web/src/UsersAdmin.tsx)); the api gains
  `listUsers/createUser/setUserDisabled/resetUserPassword` (real + fake); the shell fetches `me()` and
  shows the **Users** nav entry only for admins (a new `UsersIcon`); member deep-links degrade to a
  permission notice.
- **Docs same-change** — `06_API_CONTRACT` user-management section.

## Definition of Done

- ✅ **Builds / typechecks / lint** — all green across workspaces + the e2e tsconfig.
- ✅ **Tests green, none skipped** — **455 Vitest + 124 e2e**. New: 5 API tests (403 for members;
  disable & reset **revoke sessions** and block re-login; re-enable restores; self-disable → 400), 4
  `UsersAdmin` unit tests, and a browser `users.spec` (admin adds → disables a member). The a11y axe
  scan now also covers the admin-only Users nav entry (clean, light + dark).
- ✅ **Authorization: default-deny + least privilege** (SECURITY.md §3) — user management is admin-only
  at the resource level; members are 403; household-scoped queries.
- ✅ **Revocation on disable/reset** — sessions are deleted, so access is cut immediately, not at
  cookie expiry.
- ✅ **Boundaries / secrets** — auth stays in the impure shell; `UserView` never carries the hash; no
  secrets logged.
- ✅ **Docs updated same-change** — API contract; ADR-0009 §7–§8 is the decision.
- ⚠ **Deferred to BUD-S89 (hardening):** last-admin protection (you can disable *another* admin,
  including the final one — only self-disable is blocked today), plus throttle/lockout and the
  threat-model property tests. Flagged for S89.
- ⚠ **Format** — one pre-existing warning (`scripts/capture-demo-assets.ts`), untouched.

**Test delta:** 446 Vitest + 123 e2e → **455 Vitest + 124 e2e** (+9 Vitest, +1 e2e).

**Commit:** `feat(api,web): admin/member roles + user management with session revocation (BUD-S88)`

## Next-session kickoff prompt

> Build **BUD-S89 (Login hardening + threat-model tests)** — the final slice of BUD-E13, per
> [ADR-0009](../adr/ADR-0009-authentication-household-scoping.md) §9. Add a **login throttle/lockout**
> on `POST /auth/login` (per username/IP), **session-expiry** tests (the `expires_at` mechanism
> exists — prove it via the injected clock), and **last-admin protection** (can't disable/demote the
> final admin). Write the **security-invariant property/e2e tests** (default-deny · cross-household
> not-found · enumeration-safety · revocation on reset/disable) and the **SECURITY.md** threat-model
> prose + the first-run-setup race note. On completion, flip **ADR-0009 → Accepted** and mark
> **BUD-E13 Done** — which clears the last exposure blocker so **BUD-E14** (hub deploy) can proceed to
> `HOST=0.0.0.0`. Keep the gate green (455 Vitest + 124 e2e as the floor). No new deps expected.
