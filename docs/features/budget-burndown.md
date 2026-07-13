---
type: feature-spec
roadmap-item: BUD-S56
status: Implemented
---
<!--
FEATURE SPEC — scopes roadmap item UX11 (2026-06-25 UX Uplift, Phase 3 "Insights"). Build as a
vertical slice that adds a NEW visualisation (not a migration): WITHIN-MONTH pace vs. target, on the
ADR-0007 contract via the shared ui/Chart primitive (reusing the existing Gauge shape). Composes an
EXISTING read (ONE call, no new endpoint / schema / API change) + one new PURE domain function for the
elapsed-time pace math. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Insights: budget burn-down

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX11                                                              |
| Status       | Implemented ([status report](../status-reports/2026-07-01-ux11.md))   |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-01                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX11`) · on the [ADR-0007](../adr/ADR-0007-accessible-charting.md) contract · builds on [FEAT-UX8](insights-charts.md) (the shared `ui/Chart` primitive, incl. the `Gauge` shape) · composes the existing [budget-vs-actual](budget-vs-actual.md) read · the within-month **companion** to budget-vs-actual (which is retrospective) |

## 1. Summary

Budget vs. actual answers "did I stay within budget?" — but only **after** the month ends. UX11
answers the same question **before** month-end: **"am I on pace?"** A new `/insights/burndown` view
shows, for a chosen month and scope (all budgeted envelopes, or one), how far through the budget you
are (**spent ÷ target**) against how far through the month you are (**elapsed calendar days**) — so a
user can course-correct mid-month, e.g. *"you're 50% through the month but 80% through your Groceries
budget — over pace."* It reuses the **`Gauge`** shape shipped in UX8 (no new chart shape): the ratio
is budget-consumed, and the gauge's existing **threshold marker is repurposed as the elapsed-time
pace** ("where you'd expect to be today").

This is a **vertical slice that adds a new visualisation**. It **composes the existing
`getBudgetVsActual(month)` read — ONE call, no new endpoint / schema / API change** — plus one new
**pure domain function** (`assessBurndown`) for the elapsed-time pace math.

## 2. The read decision — one `getBudgetVsActual` call + a pure pace function

A burn-down needs three numbers per scope: the **target** (budget), the **spent-so-far**, and the
**expected pace so far**. The first two come straight from an existing read; only the third is new,
and it's pure client-computable math — so nothing new is needed server-side.

| Input | Source | Notes |
| ----- | ------ | ----- |
| target, spent (per envelope + household) | **`getBudgetVsActual(month)`** — **ONE call** | Already returns every envelope's `targetCents`/`spentCents` and the month. `spentCents` is pure outflow (funding excluded, refunds netted) — the correct burn-down numerator, same semantics UX9/UX10 established |
| expected pace so far | **`assessBurndown(...)`** — a **new pure domain function** | Elapsed-time fraction of the month as of today (day _d_ of _D_ ⇒ _d/D_; 0 before the month, 1 once over), compared to spent ÷ target |

**No fan-out** (unlike UX10, which called `getBudgetVsActual` once per month): a burn-down is a
single month, and that one call already returns every envelope row plus the household totals, so the
**scope picker just selects which numerator/denominator to gauge** — no extra requests. This is the
lightest end of the R4/R5/UX9/UX10 "compose existing reads, add no endpoint" precedent.

### 2a. The pace proxy — elapsed calendar days (linear burn), as a PURE function

"Expected spend so far" is modelled as the **elapsed-time fraction** of the month — a **linear-burn**
assumption (spend should track the calendar). This is a deliberate V1 **proxy**, not a prediction:
real spend is lumpy, so the elapsed fraction is a **reference** pace the user compares against, and
the exact figures are always in the table. A more nuanced pace (e.g. weighting recurring bills by
their due dates) is **out of scope** for this slice.

The math is **non-trivial** (past/current/future-month branching, days-in-month, timezone-safe string
parsing), so per the project's **pure-core / impure-shell** convention (mirroring `forecast.ts`,
which takes `today` in and never reads the clock) it lives in a **pure, unit-tested domain function**,
`packages/domain/src/burndown.ts`:

- `monthElapsedFraction(month, today)` → `0..1` (reuses the existing `daysInMonth`).
- `assessBurndown({ month, targetCents, spentCents }, today)` → `{ elapsedFraction, consumedFraction, status }`,
  where `status ∈ "over-budget" | "over-pace" | "on-track"` (`over-budget` = spent past the whole
  target; `over-pace` = consuming faster than the calendar; `on-track` = at or below the calendar).

The **view** passes the real `today`; the **pure function** takes it as an argument, so the pace logic
is deterministic under unit test (fixed `today`) with no clock mocking in the domain layer.

## 3. Chart design — reuse the `Gauge` shape as-is (threshold = "pace today")

The burn-down is **one ratio + one reference marker** — exactly the `Gauge` shape's job (credit
utilization and debt payoff already use it for a single ratio + a threshold). No new shape or variant:

- `ratio` = **spent ÷ target** (budget consumed); the existing over-cap fires when spent > target.
- `threshold` = **`{ at: elapsedFraction, label: "Pace today (X%)" }`** — the existing threshold
  marker, repurposed **as-is** to mean "where you'd expect to be today." No second marker needed.
- **Colour is never the sole signal.** The over/under/on-track state is carried by **position** (the
  fill end relative to the pace marker), by **text** (the gauge `valueLabel`, a one-line **verdict**
  sentence above the gauge, and the `role="img"` summary), and by the **exact figures + a text pace
  column** in the data table. The single `--chart-1` token carries no state on its own.

The alternative — a new "burn-down curve" shape (a target line vs. a cumulative-spend line over the
days of the month) — was considered and rejected: it needs **day-by-day spend**, which the existing
read doesn't give (it returns a single month total), so it would force a new endpoint for a marginal
gain over the ratio-vs-pace gauge, which answers "am I on pace?" directly.

## 4. The view (`/insights/burndown`)

`BudgetBurndownView.tsx`, a 9th Insights tab ("Burn-down") next to Budget:

- A **Month** picker (`type="month"`, defaults to the current month, capped at this month — same
  control convention as Budget/Breakdown) and a **Scope** `<Select>` — **"All budgeted envelopes"**
  (the household aggregate over budgeted rows) or a **specific budgeted envelope**. Only envelopes
  with a target set are selectable (a burn-down needs a budget to pace). Changing the month resets the
  scope to "all" so the picker can never point at an envelope that isn't budgeted that month.
- The chart: a `Gauge` of the selected scope (consumed ratio + the pace marker), a one-line summary,
  and a **verdict** sentence stating on-track/over-pace/over-budget in words. Above the **data table**
  — every budgeted envelope's target · spent · % of budget · pace (text), plus an "All budgeted
  envelopes" aggregate footer — the keyboard/SR source of truth.
- Cockpit: **left unchanged** (same reasoning as UX9/UX10 — the cockpit's budget panel already
  deep-links into Insights; a pace gauge doesn't fit a cockpit slot without scope creep).

## 5. Acceptance criteria

- [x] `/insights/burndown` shows, for a chosen month and scope (all budgeted envelopes, or one), the
      **budget consumed** (spent ÷ target) against the **month elapsed** (calendar-day fraction) as a
      `Gauge` with the pace as a threshold marker.
- [x] Composes the **existing** `getBudgetVsActual` read — **ONE call, no new endpoint / schema / API
      change**; the elapsed-time pace is a **new pure domain function** (`assessBurndown`), unit-tested.
- [x] The pace is the **elapsed-time fraction** (day _d_ of _D_ ⇒ _d/D_; 0 before the month, 1 once
      over) — a documented linear-burn **proxy**, not a prediction.
- [x] `status ∈ over-budget | over-pace | on-track`; **over-budget** (spent past the target) is
      reported ahead of pace; the state is carried by **text + position**, never colour alone.
- [x] The `Gauge` is `role="img"` with a concise one-line `aria-label` summary; innards are
      `aria-hidden`; the table carries every exact figure (target · spent · % · pace) + an aggregate.
- [x] Scope picker selects household aggregate or one budgeted envelope from the **same one read** (no
      fan-out); changing the month resets scope to "all".
- [x] **axe-clean (WCAG 2.2 AA, serious/critical) in LIGHT and DARK** with the gauge rendered —
      `e2e/a11y.spec.ts` seeds a budgeted envelope with mid-month outflow and scans both schemes.
- [x] No opacity animation on text; honours `prefers-reduced-motion` (inherited from `ChartFigure`).
- [x] Bundle stays under the **120 KB gz** ceiling (111.06 KB gz after UX11, ~8.9 KB headroom).
- [x] Gate green: typecheck · lint · format · unit (**335 Vitest passing**, +13: 8 domain + 5 web;
      1 pre-existing unrelated `recurring.test.ts` carry) · e2e (**81 Playwright**, +3) · build.

## 6. UX states

- **Loading** — `role="status"` "Loading…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — when no envelope has a target set: guidance copy ("No budgets set for {month} — set a
  monthly target in Insights — budget vs. actual, then come back to pace it."); **no gauge, no scope
  picker**.
- **Populated** — a verdict sentence + the gauge (`role="img"` + summary) above the exact-figures
  data table.

## 7. Out of scope (later Insights items)

A day-by-day cumulative burn-down **curve** (needs per-day spend, i.e. a new read), a **projection**
of end-of-month spend (extrapolating the current pace), and pace-aware **alerts/notifications** are
deferred — the ratio-vs-pace gauge answers "am I on pace?" without a new read or a new chart shape;
a future slice can add a projected end-point or a curve without changing this view's contract. UX11
is the **fourth and final new-visualisation slice** of the Insights phase; the UX Uplift **Polish**
track (`UX12`–`UX15`) follows.
