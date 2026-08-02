---
type: standard
status: Accepted
---
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

### ETL / bulk-import artifacts are two grades — plan the split when the ETL starts

A real-data extraction or import effort produces two kinds of artifact, and they need
different treatment from the moment work begins, not caught at review time:

- **Committable:** the tooling itself (extractors, transforms, schema maps) and any
  **redacted** findings/analysis derived from it.
- **Gitignored, local-only:** working docs that carry real amounts, names, or other
  confidential content — even excellent analysis is disqualified from the repo the moment
  it quotes real data.

Have the ETL write its working docs into a gitignored path **by default** (the scaffold's
`.gitignore` already excludes `/data/`, `/private/`, `/reports/`) so commit hygiene is
structural, not a last-minute catch that depends on someone remembering to check. (Hit here
in the `budget-extraction` review, 2026-07-10, K27 — the catch only happened because
`SECURITY.md` + a prior spike's redaction precedent existed to check against.)

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
- **Keep the reachable surface as small as the auth story.** budgeteer now implements
  authentication (BUD-E13 / ADR-0009): **default-deny at the resource level**, opaque **revocable
  server-side sessions** (HttpOnly, `SameSite=Strict`, `Secure` in prod), **scrypt**-hashed
  passwords, **enumeration-safe** login with a per-`(IP, username)` **brute-force throttle**, and
  **last-admin protection**. Disabling/resetting a user **revokes their sessions** immediately. The
  API still binds **loopback (`127.0.0.1`) by default** (env `HOST`, EH11) as defense-in-depth;
  serving `0.0.0.0` on the LAN is now safe because auth is in place (the `#19`/BUD-E13 exposure
  blocker is closed). CORS is a browser courtesy and does not gate non-browser clients.
- **First-run setup is atomic (BUD-S92 — closed, not accepted).** `POST /auth/setup` used to gate on
  a separate "zero users exist" count and then insert: a check-then-insert race, previously recorded
  here as *accepted* on the grounds that it was a narrow window on a trusted LAN reachable only by
  someone who knew the endpoint existed. `BUD-S92` put the endpoint behind a discoverable `/setup`
  screen, which retires that reasoning, so the race was closed rather than inherited. The
  zero-users test now lives **inside the write** (`insert … select … where not exists`), and a
  **partial unique index** on the bootstrap row (migration `0004`) settles the case the statement
  alone cannot — under READ COMMITTED two concurrent transactions can both find the table empty, so
  the loser is rejected by the index (`23505`, mapped to the existing `409`). **The winner is
  decided by Postgres, not by a count that raced.** The constraint is scoped to the *bootstrap* row,
  not to "one admin" — a household may have several (BUD-S88). Pinned by two tests: three concurrent
  setups yield exactly one admin, and the index itself rejects a second bootstrap row (the mechanism,
  asserted separately because PGlite's single connection serializes the first test).
  The `needs-setup` probe added by the same slice is public and carries the boolean and nothing else.

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
