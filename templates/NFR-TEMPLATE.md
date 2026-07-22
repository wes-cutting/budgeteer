<!--
NFR / OPERATIONAL-READINESS TEMPLATE — copy to docs/07_NFR.md. The non-functional
requirements and the operational readiness a project must meet before it's treated as
production. Mostly written/validated during the HARDENING phase (docs/00_WAYS_OF_WORKING.md
§7), against REAL data volumes and usage — not an empty dev database. Measure before
optimizing. Keep it in sync with the budgets/alerts actually configured.
-->

# Non-Functional Requirements & Operational Readiness — <Project>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Draft · Proposed · Validated · Accepted |
| Owner        | <name>                                 |
| Last updated | <YYYY-MM-DD>                           |

> **Measure before optimizing**, and assert every budget against **realistic data volumes
> and usage**, not an empty dev database ([`ENGINEERING_STANDARDS.md`](../docs/ENGINEERING_STANDARDS.md)
> §5). An unmeasured target is a guess — record how each one is verified.

## 1. Performance budgets

Concrete, testable targets for the critical journeys. Each maps to a perf test run at a
realistic volume.

| Journey / operation | Budget | At volume | How verified |
| ------------------- | ------ | --------- | ------------ |
| <e.g. list page p95> | <e.g. < 300 ms> | <e.g. 100k rows> | <load test name> |

## 2. Capacity & scale

- Expected data volumes today and the growth assumption (rows, requests/sec, concurrent
  users).
- Known limits / bottlenecks — the first thing that breaks under load.
- The realistic dataset used for perf tests and how it's generated (**synthetic, never
  real** confidential data).

## 3. Availability & reliability

- **SLO(s):** the target (e.g. 99.9% successful requests over 30 days) and the error budget.
- **Degradation:** behavior under partial failure (timeouts, retries, circuit-breaking,
  graceful read-only mode).
- **Data integrity under failure:** invariants that must hold (idempotence, no partial
  writes — reconcile-or-roll-back where it applies).

## 4. Observability

- **Structured logging** with a correlation id **from the first slice** (not retrofitted).
- **Metrics:** the few that matter (latency, error rate, saturation) and where they're seen.
- **Tracing:** added as the system grows; the spans that cross service boundaries.
- **Alerts:** what pages a human, the threshold, and the runbook it links to (§7).

## 5. Security & privacy NFRs

Project-specific targets **on top of** the baseline (see
[`SECURITY.md`](../docs/SECURITY.md) — don't duplicate it):

- Data classification & retention: what's confidential, how long it's kept, how it's deleted.
- The dependency/vulnerability (SCA) gate and its failing threshold (wired into CI early).
- Authn/authz model specifics, secrets management, and any compliance regime that binds.

## 6. Accessibility

Baseline is **WCAG 2.2 AA** on user-facing surfaces
([`ENGINEERING_STANDARDS.md`](../docs/ENGINEERING_STANDARDS.md) §2). Record project-specific
concerns, the audit cadence, and the tools used.

## 7. Operational readiness

The checklist before anything is treated as production (see
[`SECURITY.md`](../docs/SECURITY.md) §6):

- [ ] **Backups + a tested restore drill** — restore is proven, not assumed. The export
      stamps its own schema version from the first one shipped, and the export→restore
      round-trip is itself the acceptance test (see
      [`ENGINEERING_STANDARDS.md`](../docs/ENGINEERING_STANDARDS.md) §4).
- [ ] **Deploy & rollback** — a documented, rehearsed path to ship and to revert.
- [ ] **Config & secrets** — from the environment, validated at startup; rotation plan.
- [ ] **Runbook(s)** — for each alert: symptom → diagnosis → action.
- [ ] **On-call / incident response** — who responds; how an incident is declared and closed.
- [ ] **Observability live** — logs / metrics / alerts actually wired before launch.

## 8. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| …        | …     | open   |
