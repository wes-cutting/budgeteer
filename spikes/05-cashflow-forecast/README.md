# SPIKE-05 — throwaway cash-flow forecast code

**This is disposable spike code, NOT the Budgeteer app.** Its only job is to prove, against
the real recurring-projection algorithm, that a **per-account cash-flow forecast** is sound —
and to settle the genuinely fuzzy fork the owner chose by folding in **monthly targets as
expected discretionary spend**: how to place a monthly target amount on a dated cash timeline
**without double-counting** money the schedule (or already-posted actuals) already accounts
for. The deliverable is the report at
[`../../docs/spikes/05-cashflow-forecast.md`](../../docs/spikes/05-cashflow-forecast.md),
not this code.

`src/recurring.ts` is **copied verbatim** from `packages/domain/src/recurring.ts` (proven by
FEAT-009, 106 tests) so the projection rides on the real schedule math with no workspace
dependency. `src/forecast.ts` is the candidate model under test.

Run:

```sh
npm install        # typescript, tsx, @types/node (dev only)
npm run typecheck  # tsc --noEmit, strict
npm test           # node --import tsx --test
```

Deliberately **not** built here: the Fastify route, the analysisService read, and the React
view — those are the *slice*, not this spike. The candidate **forecast model** is what's under
test.
