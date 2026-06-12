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
| **End-to-end** | Critical user journeys through the running app | Slower | Includes an **accessibility scan** on user-facing flows. |

Guidelines:
- **Most coverage at the bottom** (pure unit), least at the top (e2e) — but every
  critical journey has at least one e2e.
- Prefer **real dependencies over mocks** at the integration layer; mocks hide the bugs
  that integration tests exist to catch.
- **Synthetic fixtures only** — never real confidential data in tests. Build fixtures in
  code where possible so they're reviewable in diffs.

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

## 4. Speed & hygiene

- Keep the unit/integration gate fast enough to run constantly; isolate slow e2e behind
  its own command.
- Reset state between tests (truncate/teardown) for isolation.
- Flaky tests are bugs — fix or quarantine with a tracked issue, never ignore.
