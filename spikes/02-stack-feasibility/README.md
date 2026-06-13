# SPIKE-02 — throwaway feasibility code

**This is disposable spike code, NOT the Budgeteer app.** Its only job is to prove, against
a real TypeScript runtime, that the genuinely risky technical bit — **integer-minor-unit
money + the exact split-allocation invariant** (the prior float attempt's failure point) —
is clean and exact in the candidate stack. The deliverable is the report at
[`../../docs/spikes/02-stack-feasibility.md`](../../docs/spikes/02-stack-feasibility.md),
not this code.

Run:

```sh
npm install        # typescript, tsx, @types/node (dev only)
npm run typecheck  # tsc --noEmit, strict
npm test           # node --import tsx --test
```

Deliberately **not** built here: the Fastify API, the Postgres wiring, and the React split
editor — those are standard, low-risk integrations asserted in the report; the split
editor's *felt friction* is closed by slice 1 (per the SPIKE-01 caveat).
