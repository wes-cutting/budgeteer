---
id: DOC-TESTING-STRATEGY
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
types/typecheck  →  lint  →  format check  →  docs check  →  unit + integration  →  e2e (incl. a11y)  →  build
```

- **A failing or skipped test blocks completion.** No exceptions, no "temporarily
  skipped."
- **A typecheck step's coverage is its tsconfig `include` list, and nothing tells you what
  it misses.** A file in no project is silently not checked while the gate reports green —
  the sibling of §5's "a scan suite's coverage is its list of surfaces" (`KIT_FEEDBACK` K40,
  K41). Audit it directly — `find . -name '*.ts'` against `tsc --listFiles` per project —
  and either cover every `.ts` or **write down** why a directory is excluded. Here that is
  three projects (workspaces · [`tsconfig.e2e.json`](../tsconfig.e2e.json) ·
  [`tsconfig.tools.json`](../tsconfig.tools.json)) covering everything but `spikes/**`.
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
- **A recurring flake in a *timing* test is a measurement bug until proven otherwise.** "The
  perf test flaked again" reads as environmental noise, and that label is what lets a broken
  measurement sit unfixed — here for a month. `measure()` computed
  `latencies[Math.floor(n * 0.95)]`, which for n=20 indexes element 19: the **maximum**, not
  p95. A budget documented as p95 was really "no single run of twenty may exceed it", so one
  GC pause failed the suite. Use a **nearest-rank percentile** (`ceil(p × n) − 1`) and discard
  a **warm-up phase**; the statistic asserted must be the statistic
  [`07_NFR.md`](07_NFR.md) names (K35).
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
- **A scan suite's coverage is its list of surfaces — so adding a route is what obliges you to
  add a scan.** A green suite is evidence about the pages someone remembered to add and
  nothing at all about a page it has never loaded. This harness (58 scans, light and dark,
  wired into the gate) stayed green across two slices shipping `/login` and `/users`, neither
  of which it ever scanned — and the DoD's *"changed UI meets AA"* box was ticked in both on
  the strength of that green. The defect it hid was real: a sign-in error at **2.78:1** in
  dark mode. This is why the DoD now asks you to **name the scans**
  ([`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) §2) (K41).
- **Verify a new scan or regression test fails against an injected defect before trusting
  it** — a test that passes the moment you write it has told you nothing. Corollary, because
  this is where the confusion starts: **verify the defect you think you found actually
  exists** before fixing it, by measuring the live system (`getComputedStyle`,
  `elementFromPoint`, a timed probe) rather than inferring a cause from the source file.
- **An auto-dismissing overlay that pauses on hover is a deadlock source, not a timing
  nuisance.** The success toast (Radix, 5s dwell, fixed bottom-right) sat over buttons at the
  foot of a growing list. The expectation is a test that waits ~5s; the reality was a **30s
  timeout** — Playwright moves the pointer onto the target on every retry, the target is under
  the toast, and Radix pauses the dwell while hovered, so the test and the toast hold each
  other open. Measured, not assumed: pointer parked on the toast → still up after 7s; pointer
  moved away → gone within the dwell. So a helper that triggers one must clear it
  deterministically **and park the pointer away** — dismissing by *clicking* leaves the pointer
  in that corner and pins the *next* toast open forever. Never wait the dwell out; you pay it
  at every mutation in the suite (K44).
- **The harness owns the ephemeral stack it tests against — never reuse a server it didn't
  start.** Attaching to a dev server "for convenience" silently invalidates empty-state
  assertions (a real dev store isn't empty) and can leak test-written data into it. Either
  the harness starts every dependency itself, or it **fails fast** with a clear message when
  a port it needs is already held — don't let it silently attach. Verify a port is genuinely
  free with the OS (e.g. `lsof -iTCP:<port> -sTCP:LISTEN`), not by trusting that a wrapper
  process was stopped — stopping the wrapper can still orphan the child holding the port
  (K20/K24; `playwright.config.ts`'s `reuseExistingServer: false` on both webServers here).
- **Keep one cold-start spec that provisions through the UI, and give it its own empty stack.** A
  shared authenticated fixture (`global-setup.ts` + `use.storageState`) is the right default for
  speed, and it is exactly what hides "the product cannot be opened at all": every spec starts
  *after* the hard part. So one spec must start from a genuinely empty datastore and create the first
  principal **through the browser**, with nothing provisioned out of band. It cannot share the
  primary stack — that store has a user before the first spec runs — so the harness starts a
  **second API + web pair** on its own ports over its own store (`e2e/cold-start.ts`,
  `e2e/first-run.spec.ts`; API `:3002` / web `:5174`). The isolation is then structural rather than a
  convention: the shared session names a row in the *other* store and cannot make the spec pass.
  Order matters inside it — completing setup makes `/setup` unreachable, so every assertion about
  that page (including its axe scans) precedes the journey, in one `serial` file. (`KIT_FEEDBACK`
  K42, the reference implementation of the archetype it asks for.)
- The reference harness is in this repo: `e2e/` (per-area Playwright specs + `e2e/setup.ts`),
  `e2e/a11y.spec.ts` (axe scan), `e2e/first-run.spec.ts` (cold start), and
  `apps/api/test/perf.test.ts` (p95 budgets).
