---
type: standard
status: Accepted
---
# Testing Strategy

| Field   | Value                                                  |
| ------- | ----------------------------------------------------- |
| Status  | Accepted                                              |
| Owner   | DrewskiLabs                                           |
| Purpose | The test layers and the gate every slice must pass.   |

Stack-agnostic: the project names the concrete runners in its `ADR-0001` and README; the
layers and the gate below are constant.

---

## 1. Test layers

| Layer | Scope | Speed | Notes |
| ----- | ----- | ----- | ----- |
| **Unit** | Pure domain + library logic (no I/O) | Instant | The bulk of tests live here because the logic lives here (pure core). |
| **Property** | Invariants over generated inputs | Fast | For rules that must always hold (exact-quantity math, idempotence, ordering, tenancy scoping). |
| **Integration** | The adapter boundary against a **real ephemeral dependency** | Moderate | Spin up a throwaway datastore/service; assert real behavior, not mocks. |
| **End-to-end** | Critical user journeys through the **running app + real API** | Slower | The only layer that exercises the **browser→API seam** (CORS, headers, content-type, preflight methods) the others mock away. Includes an **automated accessibility scan** (e.g. axe) on user-facing flows. |
| **Performance** | The heaviest reads/journeys at a realistic data volume | Slowest | Assert the `07_NFR.md` budgets (p95) against **synthetic volume**, not an empty dev DB. |

Guidelines:
- **Most coverage at the bottom** (pure unit), least at the top (e2e) — but every
  critical journey has at least one e2e.
- Prefer **real dependencies over mocks** at the integration layer; mocks hide the bugs
  that integration tests exist to catch.
- **Synthetic fixtures only** — never real confidential data in tests. Build fixtures in
  code where possible so they're reviewable in diffs.
- **Ship the real browser→API smoke in the foundation, not in hardening.** The unit /
  integration / component layers never exercise a real browser hitting the real API, so a
  whole class of bug (CORS, content-type, preflight methods) is invisible to them — exactly
  what shipped here as the CORS bug, caught only by running the app by hand. Wire one real
  e2e (app loads + one journey against the running API) **and** lint in the foundation slice,
  so "the gate" is real on day one rather than aspirational.
- **Lint config must exclude nested, tool-created checkouts from day zero** (e.g. `.claude/`,
  `**/worktrees/**`). An agent-spawned worktree left behind after a task looks like source to
  a repo-wide lint sweep — often without its own `node_modules`, so it fails with confusing
  "rule not found" errors that read as a real regression, not an environment artifact.
  `git worktree list` is the first diagnostic when lint errors point outside the working tree
  (SPIKE-11 gate run, K28).

## 2. What must be tested

- **Every acceptance criterion** (feature spec + UX spec) maps to at least one test.
- **Invariants** (the recommended patterns you adopted — exact-quantity math, derived
  values, tenancy scoping) get **property tests**, not just examples.
- **Edge/error paths and UX states** (empty/loading/error/success), not only happy paths.
- **Reconcilable imports/migrations**: a test that the reconciliation gate **passes** on a
  good fixture and **fails** on a deliberately corrupted one.

## 3. The gate

Every slice must pass, locally and in CI, before it's done:

```
types/typecheck  →  lint  →  format check  →  unit + integration  →  e2e (incl. a11y)  →  build
```

- **A failing or skipped test blocks completion.** No exceptions, no "temporarily
  skipped."
- CI runs the same gate as local; keep them identical. The baseline ships a CI skeleton at
  [`.github/workflows/gate.yml`](../.github/workflows/gate.yml) encoding this order — wire
  each step to the project's commands (it fails until configured, so a skeleton never
  reports a false green).
- Tests should need **no manual setup** — ephemeral dependencies boot as part of the test
  run.
- Keep the exact gate **commands in one canonical place** (the project README's scripts
  table) and *reference* it from CI and status reports — don't restate them in three docs,
  they drift (a step gets added in one place and missed in another).

## 4. Speed & hygiene

- Keep the unit/integration gate fast enough to run constantly; isolate slow e2e behind
  its own command.
- Reset state between tests (truncate/teardown) for isolation.
- Flaky tests are bugs — fix or quarantine with a tracked issue, never ignore.
- **Relative-date fixtures tested against the real calendar are a smell** — a test that
  passes today and fails on some future date with no code change. Use fixed/injected dates
  (the injected-clock pattern, [`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) §4; EH7).
- **Demo/seed-data captures earn the same reset-before-run discipline as tests** — see the
  demo-asset-capture pattern ([`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) §4).

## 5. e2e conventions

- **Split specs per area, with a shared setup helper**; every new slice lands with its own
  spec. A single growing journey file is slow to isolate when it breaks.
- Prefer **`exact: true`** for accessible-name/role queries when the target name appears
  inside another element's accessible name — a substring match silently grabs the wrong control.
- The a11y scan should fail on **serious/critical** violations and ship a baseline
  accessibility CSS floor (e.g. a minimum interactive target size) so WCAG 2.2 AA is enforced
  from commit zero, not discovered late.
- **The harness owns the ephemeral stack it tests against — never reuse a server it didn't
  start.** Attaching to a dev server "for convenience" silently invalidates empty-state
  assertions (a real dev store isn't empty) and can leak test-written data into it. Either
  the harness starts every dependency itself, or it **fails fast** with a clear message when
  a port it needs is already held — don't let it silently attach. Verify a port is genuinely
  free with the OS (e.g. `lsof -iTCP:<port> -sTCP:LISTEN`), not by trusting that a wrapper
  process was stopped — stopping the wrapper can still orphan the child holding the port
  (K20/K24; `playwright.config.ts`'s `reuseExistingServer: false` on both webServers here).
- The reference harness is in this repo: `e2e/` (per-area Playwright specs + `e2e/setup.ts`),
  `e2e/a11y.spec.ts` (axe scan), and `apps/api/test/perf.test.ts` (p95 budgets).
