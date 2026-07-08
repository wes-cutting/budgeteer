# Security Baseline

| Field   | Value                                                  |
| ------- | ----------------------------------------------------- |
| Status  | Accepted                                              |
| Owner   | DrewskiLabs                                           |
| Purpose | The security posture every project starts with, from commit zero. |

Stack-agnostic defaults. A project adds specifics (chosen hash, session mechanism) in its
own ADRs but never weakens the baseline below.

---

## 1. Secrets & confidential data (from commit zero)

- The scaffold ships a `.gitignore` that excludes **secrets** (`.env*`, key files) and
  **local/confidential data files** *before* any such file exists.
- **Never** commit or log secrets, tokens, credentials, or real user/confidential data.
- Real data stays local; **tests use synthetic fixtures**.
- Configuration and secrets come from the environment; validated at startup. The scaffold
  ships [`.env.example`](../.env.example) (the only tracked env file) as the template to
  copy to a gitignored `.env`.

> If confidential data ever does land in history, scrubbing it requires a history
> rewrite — expensive and error-prone. The guardrail belongs in the scaffold, not in a
> spec written later.

## 2. Input & output

- **Validate all external input at the boundary** (requests, files, env, third-party
  responses) against an explicit schema; reject invalid input loudly.
- Encode/escape output appropriately for its sink; never build queries or markup by string
  concatenation of untrusted input.
- Return a **consistent error envelope**; never leak stack traces, secrets, or internal
  identifiers in errors.
- **CORS is an allowlist, never `*`.** The browser app calls the API cross-origin, so the API
  sends CORS headers (`@fastify/cors`) only for explicitly configured origins (env
  `CORS_ORIGINS`; dev default = the Vite origin). Widen it deliberately per environment.

## 3. Authentication & authorization

- **Default-deny authorization**, checked at the **resource level** — not just at a route
  or in the UI.
- For multi-tenant/multi-user systems, scope every query by the caller's tenant/owner and
  return **not-found** (not forbidden) for cross-tenant access, so existence doesn't leak.
- **Enumeration-safe** auth/recovery flows: sign-in and password-reset responses don't
  reveal whether an account exists; equalize timing.
- Store passwords with a strong, salted KDF (e.g. a memory-hard algorithm). Sessions:
  server-side or signed, with sensible expiry; invalidate sessions on password reset and
  on disabling an account.
- Apply least privilege everywhere (roles, scopes, tokens).
- **Keep the reachable surface as small as the auth story.** While the API has no
  authentication (the deferred `#19` epic), it binds **loopback (`127.0.0.1`) by default**
  (env `HOST`, validated at startup — EH11). Exposing it to the network (`0.0.0.0`) is a
  deliberate per-environment opt-in, and doing so is the documented trigger to pull `#19`
  forward — CORS is a browser courtesy and does not gate non-browser clients.

## 4. Dependencies & supply chain

- Wire a **dependency/vulnerability scan (SCA)** into CI as a gate, early — it's the
  easiest hardening step to defer and regret.
- Pin versions via a lockfile; review/refresh dependencies deliberately.

## 5. Privacy

- Treat user data as confidential by default; collect the minimum needed.
- Reports, exports, and logs must not leak secrets or more data than intended.

## 6. Operational

- Backups/restore drill and observability (structured logs with correlation ids, then
  metrics/tracing) before anything is treated as production.
- Capture the full operational-readiness checklist (backups/restore, deploy/rollback,
  config & secrets, runbooks, on-call) in the project's `07_NFR.md`, from
  [`../templates/NFR-TEMPLATE.md`](../templates/NFR-TEMPLATE.md).
