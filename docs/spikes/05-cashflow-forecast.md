---
type: spike
id: SPIKE-05
roadmap-item: [BUD-S17, SPIKE-05]
status: Done
---
<!--
SPIKE REPORT — the deliverable; the code is disposable (lives at
spikes/05-cashflow-forecast/, gitignored deps). See docs/00_WAYS_OF_WORKING.md §6.
-->

# SPIKE-05: Can we project a per-account cash-flow forecast, and fold monthly targets in as expected spend without double-counting?

| Field    | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Status   | Done                                                                                      |
| Type     | Technical / modeling                                                                       |
| Owner    | Wesley Cutting                                                                             |
| Time-box | One session (~1–2 h) — honored                                                            |
| Date     | 2026-06-16                                                                                 |
| Blocks   | [`features/cash-flow-forecast.md`] · [`ux/cash-flow-forecast.md`] · `06_API_CONTRACT` · roadmap `#13` |

## 1. The question

`#13` is the analysis area's one genuine modeling fork: unlike `#11`/`#12` (which only
**aggregate** existing data), it **projects** the future. The owner chose the **richer** V1
(challenge-the-plan, settled before building): forecast a single account's **cash balance**,
event-stepped over a 90-day horizon, driven by **both** (1) scheduled recurring rules **and**
(2) monthly targets (`#12`) folded in as **expected discretionary spend**.

The recurring **schedule** math is already proven (FEAT-009, 106 tests) and starting balance is
the derived `v_account_balances` — those carry no empirical risk. The single falsifiable question
is the part choosing "+ expected spend" reintroduced:

> **Can a monthly target be placed on a dated cash timeline as expected spend WITHOUT
> double-counting money the schedule (or already-posted actuals) already accounts for — such that
> the projection is exact (integer cents), and the firm "scheduled-only" floor and the softer
> "+ expected" line are both derivable?**

A "no" (or an unavoidable double-count) would force scheduled-only V1; a "yes" tells the spec the
exact netting + spreading rule to build.

## 2. Method

A **throwaway** TypeScript model (`spikes/05-cashflow-forecast/`, disposable — *not* the V1 app),
asserted with `node:test` under strict `tsc`:

- `src/recurring.ts` — the engine's `dueOccurrences`/`nextOccurrence`/`anchorDayOf`, **copied
  verbatim** from `packages/domain`, so the projection rides on the real schedule math. The only
  new use: feed `dueOccurrences` a **future horizon** date as the `bound` (it has only ever been
  called with `today`).
- `src/forecast.ts` — the candidate model: `runningBalance` (pure event-stepping core),
  `scheduledEvents` (engine → future dated ± cash events), `expectedSpendEvents` (the
  target-netting + spreading under test), `buildForecast` (assembly with a scheduled-only vs.
  `+expected` toggle).
- `src/forecast.test.ts` — a realistic single-account fixture (Checking, today `2026-06-16`,
  $1,240 start; biweekly $2,100 paycheck; monthly $1,500 rent + $120 electric; targets Groceries
  $400 / Dining $150 / Utilities $120 / Rent $1,500; June actuals already posted).

**Deliberately not built:** the Fastify route, the `analysisService` read, the React view — those
are the *slice*. The **model** is what's under test.

## 3. Findings

Real output:

```
=== tsc --noEmit (strict) ===  TYPECHECK: PASS
=== node --test ===            # tests 8  # pass 8  # fail 0
```

The headline 90-day forecast (scheduled + expected, even-daily), real numbers — scheduled events
only shown:

```
Forecast: Checking, 2026-06-16 → 2026-09-14, start $1240.00
  ending $9517.34 · min $1207.84 on 2026-06-19 · first-negative never
  103 events (scheduled + daily expected-spend)
    2026-06-19   $2100.00 →  $3307.84  Paycheck
    2026-06-20   -$120.00 →  $3187.84  Electric
    2026-07-01  -$1500.00 →  $1570.00  Rent
    2026-07-03   $2100.00 →  $3616.75  Paycheck
    ...
    2026-09-11   $2100.00 →  $9584.33  Paycheck
```

The crux (test 3, the gold) — expected-discretionary residual per month, from
`target − actualThisMonth − scheduledThisMonth`, floored at 0:

| Month | Groceries | Dining | Utilities | Rent | Month residual |
| ----- | --------- | ------ | --------- | ---- | -------------- |
| Jun (current) | 400−360 = **40** | 150−40 = **110** | 120−**120 sched** = 0 | 1500−**1500 actual** = 0 | **$150** |
| Jul (full)    | **400** | **150** | 120−**120 sched** = 0 | 1500−**1500 sched** = 0 | **$550** |
| Aug (full)    | **400** | **150** | 0 | 0 | **$550** |
| Sep (partial, 14/30) | prorated | prorated | leaks* | 0 | **$312.66** |

\* Sep electric (09-20) falls **outside** the 90-day window, so Utilities isn't netted there and
its target leaks into the prorated tail. See caveat below.

### Confirmed

- **The recurring engine projects the future unchanged.** Fed the horizon as its `bound`,
  `dueOccurrences` enumerated exactly the future paychecks/rent/electric (`06-19, 07-03, …, 09-11`
  etc.), and filtering `date > today` kept past-due-unposted occurrences out. **No engine change
  is needed** — the slice reuses it as-is.
- **The event-stepping core is exact.** Running balance, ending balance, **minimum balance + its
  date**, and **first-negative date** are all correct integer cents, with conservative same-day
  ordering (most-negative delta first → the honest "could I bounce?" floor).
- **Anti-double-count works (the answer to the question is YES).** Netting the target against
  already-scheduled outflow **and** already-posted actuals makes fully-budgeted envelopes (Rent,
  Utilities) contribute **exactly $0** of expected spend. Only genuinely discretionary envelopes
  (Groceries, Dining) generate residual. Naively adding the raw targets would have **double-counted
  $1,620/mo** ($1,500 rent + $120 electric) — proven exactly (test 4: `$2,170 full − $550 residual
  = $1,620` excluded).
- **Both lines are derivable and consistent.** Scheduled-only is the **firm floor**; `+expected`
  only ever **lowers** balance/min (residual ≥ 0). A UI **toggle** between them is the clean answer
  to "concrete vs. richer" (test 5).
- **Integer-cent exact spreading.** Even-daily distribution of an odd residual sums back exactly
  with no drift (test 6); first-negative detection lands on the exact date (test 7,
  `−$1,300` on `2026-07-01`, recovering on the `07-03` paycheck).

### Invalidated

- **"Just add the monthly targets to the projection."** That double-counts every bill that is also
  a recurring rule (here $1,620/mo). Targets must be **netted** against the schedule + actuals
  first; the residual is the only honest "expected" amount.
- **"Targets need their own dates / a new dated table."** No — the monthly residual is *spread*
  over the in-window days. A forecast is a **pure read-only derivation**; **no new table** is
  required (like `#11`).
- **"Past-due unposted occurrences belong in the forecast."** Mixing them in makes t=0 inconsistent
  with the derived balance. Strictly-future only; the past-due count stays the Recurring view's
  `dueCount` concern.

### Surprises / caveats uncovered (→ settle in the spec)

- **Account attribution is the soft spot.** Envelopes carry **no account link**, so a per-account
  *cash* forecast can't know which account a discretionary target is spent from. V1 attributes the
  **whole household discretionary residual to the forecast account** (assumption: "this account
  pays the budget"). The toggle makes this honest — the firm scheduled-only line never depends on
  it.
- **Partial-month edges.** The **current** month uses `target − actual` (the genuine remaining
  budget, *not* prorated); a **future tail** month clipped by the horizon is prorated by day
  fraction. A scheduled bill just outside the window (Sep electric) isn't netted, so its target
  leaks as a small residual in the tail — acceptable for a *budget* projection and documented.
- **Spreading strategy is a display choice, not a correctness one.** `evenDaily` (smooth, realistic)
  vs. `monthStart` (conservative, dip-early) move *where within a month* the balance dips, not the
  month endpoints. Recommend `evenDaily` default; note `monthStart` as the conservative alternative.

## 4. Recommendation / decision

**Build `#13` as specced below — no follow-up spike.** The model is proven exact and the one fuzzy
fork (target-folding) is resolved by the netting + spreading rule above.

1. **Forecast one selected account's cash**, event-stepped, from `v_account_balances`, default
   horizon **90 days** (query param, capped e.g. 7–365).
2. **Scheduled events** = that account's recurring rules via the engine, `date > today`,
   `date ≤ horizon`.
3. **Expected spend (toggle, default on)** = per month, `Σ over target envelopes max(0, target −
   actualThisMonth − scheduledThisMonth)`, current-month un-prorated / future-tail prorated, spread
   **even-daily**, attributed to the forecast account (documented assumption).
4. **Derive the headline answers:** ending balance, **minimum balance + date**, **first-negative
   date** (the "will I make it to payday?" answer).
5. **Boundaries:** the projection math is a **pure domain function** (`forecast()` over balance +
   dated events + targets); the `analysisService` read feeds it I/O; the view is thin with a
   scheduled-only / `+expected` toggle.

## 5. Impact on the plan

- **Specs/ADRs:** new `features/cash-flow-forecast.md` + `ux/cash-flow-forecast.md`;
  `06_API_CONTRACT` (the `GET /analysis/cash-flow-forecast` endpoint + report shape);
  `04_DOMAIN_MODEL` (a **derived Forecast** note + the expected-spend definition) — all **with the
  slice**. **No `05_DATA_MODEL` change** (read-only derivation, no new table) — a real difference
  from `#12`. No ADR (the target-folding is a *definition*, not an effective-dated/irreversible data
  decision — same call as `#11`/`#12`).
- **Scope:** V1 = **per-account**, scheduled **+ expected (toggle)**. Multi-account/total cash and a
  per-envelope→account attribution are documented post-V1 refinements.
- **Sequencing:** unchanged — `#13` now `Ready` to build; `#14` (debt & credit) follows.

## 6. Follow-ups

- [x] Spike proves the model (8/8, strict tsc). — done 2026-06-16.
- [x] Owner confirms the settled points (2026-06-16): **per-account scope** ✓, the **attribution
      assumption** (household discretionary → forecast account, mitigated by the toggle) ✓, the
      scheduled-only/`+expected` **toggle defaults ON** ✓, and **evenDaily / 90-day** defaults ✓.
- [ ] Write `features/cash-flow-forecast.md` + `ux/cash-flow-forecast.md`; update `06_API_CONTRACT`
      + `04_DOMAIN_MODEL` — with the slice.
- [ ] Build `#13` as a vertical slice (pure domain `forecast()` → `analysisService` read → endpoint
      → thin view); gate-green.
- [ ] Discard `spikes/05-cashflow-forecast/` once its findings are absorbed (throwaway).
