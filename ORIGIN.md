# Origin & lessons

This baseline exists because a prior project reached a complete, fully tested, gate-green
state — and was still scrapped. Not because the code was bad, but because the **process**
produced a polished system around assumptions that were never validated. This kit is the
distillation of what went wrong and what worked, so the next project starts ahead.

## What went wrong (and the fix each became)

The first **five** are the process failures that produced the polished-but-scrapped
system (the "five failures" in [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md)
§1). The sixth — *data in the repo* — is the hygiene guardrail the same episode taught us
to ship from commit zero.

| Failure | What happened | Fix encoded in the kit |
| ------- | ------------- | ---------------------- |
| **Horizontal build** | A whole back end was built before any UI; the first warning sign was a feature with nothing to click. | Vertical slices (data → API → UI); UX spec required per feature. |
| **Spec ahead of reality** | Specs/ADRs were "Accepted" describing a data source/integration nobody had inspected; reality differed. | Spike first; status `Proposed` until validated. |
| **Risk last** | The biggest unknown (does the external data load/reconcile?) ran last, after everything depended on it. | Sequence by uncertainty; front-load risk. |
| **Untested value** | When the core bet was finally exercised, it produced nothing usable. | Value-hypothesis spike before building around a bet. |
| **False-certainty docs** | Rigor and "Accepted/Shipped" status were mistaken for correctness. | A document-status ladder that separates decided from validated. |
| **Data in the repo** | Confidential data was committed early and had to be scrubbed from history. | `.gitignore` guardrails in the scaffold from commit zero. |

## What worked (kept as recommended patterns)

- **Pure core / impure shell** — logic testable without infrastructure; real logic could
  be run against real inputs without standing up the whole app.
- **Pass/fail gates** — a reconciliation/invariant gate turned "did it work?" into a
  check, not a hope.
- **Exact-quantity discipline** — integer-minor-unit money: zero rounding bugs.
- **Strict boundaries & default-deny authz** — never a source of bugs.
- **Resumable documentation** — clean hand-offs between work sessions.

These live as **opt-in recommended patterns** in
[`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) §4 — guidance, not
mandates, so the baseline stays stack-agnostic.

## The one-line takeaway

**Look at the real data and build one thin vertical slice end-to-end before committing to
specs and architecture.** Almost every failure above is a symptom of deciding on paper
ahead of validating in reality.
