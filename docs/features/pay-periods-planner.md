<!--
FEATURE SPEC — scopes roadmap item UXR2 (2026-07-06 UX Redesign). The build/data/test side of
the pay-period planner; look/behavior in the paired UX spec (docs/ux/pay-periods-planner.md,
Proposed). Extends FEAT-S7's PRESENTATION only — the domain policy (balanced latest-fit), the
endpoint's plan math, and the §5 ratify/veto + §8 assignment-store decisions are untouched.
-->

# Feature Spec — Pay-period planner (first-class, at-a-glance)

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Feature ID   | FEAT-UXR2                                                               |
| Status       | **Implemented** (2026-07-07) — built gate-green; see §8 "as built"      |
| Owner        | Wesley Cutting                                                          |
| Last updated | 2026-07-07                                                              |
| Related      | [UX spec](../ux/pay-periods-planner.md) (`Proposed`) · extends [FEAT-S7](pay-periods.md) presentation · [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · [`06_API_CONTRACT`](../06_API_CONTRACT.md) (additive change, documented at build) |
| Gated by     | UXR1 (nav placement + heading rule)                                     |

## 1. Summary

Promote the S7 surface to a first-class **`/pay-periods`** page (sidebar Planning group; the
old `/insights/pay-periods` redirects) and re-lay it as the sheet's two side-by-side ledgers —
**Bills** and **Paychecks** — restoring the two dropped figures (**projected Balance**,
**Reserve**) and the **left-to-pay countdown in both scopes**. All four design questions are
owner-resolved (UX spec §11).

## 2. API change (additive — the resolved Q2)

`GET /analysis/pay-periods` — each paycheck bucket gains two fields (names final at build):

- `projectedBalanceCents` — the account's projected balance **on that payday**, stepped from
  the same `gatherProjectionInputs` the forecast uses (one gather; the plan and its balances
  cannot disagree).
- `reserveCents` — the running Σ of per-check headroom **through this check** (the sheet's
  *Funds* column, owner-confirmed as "accumulating leftovers"); bucket zero seeds the run.

Additive only — no field removed/renamed, no version bump (the EH12 stance);
`06_API_CONTRACT` updated **in the same change**. The countdowns are **not** API fields: both
scopes (month + horizon) derive client-side from the bills already in the response.

## 3. Domain

Extend the pure **`payPeriodPlan`** (`packages/domain/src/payperiod.ts`) to emit the two
figures — the balance stepping reuses the forecast's event walk; reserve is a fold over the
existing headroom outputs. Pure-core rule holds: `today`/inputs passed in, no I/O; the service
passes values through. Definition edge to pin in tests: reserve across an **over-committed**
bucket (negative headroom reduces the run — it does not clamp).

## 4. Routing & UI

- `routes.tsx`: `/pay-periods` (title handle "Pay periods"); `/insights/pay-periods` →
  `<Navigate replace>`; the Insights sub-nav drops the tab (AnalysisSection's VIEWS list).
- `PayPeriodsView` re-laid per the UX spec: two `.table-scroll` ledger tables side by side
  (CSS grid; stacked ≤ 640px, Paychecks first), month-boundary subtotal rows + the 90-day
  pane figure, selection-highlight via `aria-pressed` row buttons **additive** over the
  permanent "Covered by" text column.
- **Cockpit (in-slice, the resolved Q4):** the Upcoming panel gains the **Next paycheck** line
  (date · committed · headroom badge → `/pay-periods`), fed by the same read. Note: this adds
  one call to the cockpit fan-out (a recorded watch item) — acceptable; panel stays
  independent/degradable like its siblings.

## 5. Testing

- **Domain unit:** balance/reserve math (multi-check months · bucket zero · over-committed
  run-down · deposit-only edge); countdown derivations (month reset at boundary · horizon sum).
- **API:** contract test asserts the additive fields; existing S7 tests unchanged.
- **Web unit:** subtotal rows · both countdown scopes · selection `aria-pressed` + highlight ·
  Covered-by text present without interaction · Next-paycheck line (populated/empty/error).
- **e2e:** journey re-pointed to `/pay-periods`; redirect test; sidebar Planning item active;
  axe light + dark; 320px reflow with stacked panes; cockpit line deep-link.

## 6. Out of scope

The assignment policy & §5 ratify/veto · §8 pinning store · `leadDays`/horizon controls ·
multi-account plans · a headroom chart (noted follow-on) · any schema change.

## 7. Acceptance

The UX spec §9 criteria, plus: figures reconcile (reserveₙ = reserveₙ₋₁ + headroomₙ; balance
matches the forecast view for the same account/date); `06_API_CONTRACT` updated in the same
change; bundle delta recorded vs. the 140 KB budget; gate green.

## 8. As built (2026-07-07)

- **Domain (Q2):** `payPeriodPlan` (`packages/domain/src/payperiod.ts`) emits the two additive
  fields. `projectedBalanceCents` is stepped from the forecast's own event walk (scheduled +
  `evenDaily` `includeExpected` spend) read off as of each `committedOn` — so it reconciles with
  `GET /analysis/cash-flow-forecast` for the same date (asserted in the API test). `reserveCents`
  is the running Σ of per-check headroom seeded by bucket zero; **it equals `headroomAfterCents`
  by construction** — the owner chose to surface it as its own field anyway (self-documenting API,
  UX §11 Q1). The over-committed run-down (no clamp) is pinned in the domain tests.
- **Countdowns** derive **client-side** in `PayPeriodsView` from the bills in the response: the
  month-scoped "left to pay" (suffix sum, resetting per month, with a `<Month> remaining` subtotal
  row) and the pane-level "Left to pay, next 90 days" figure.
- **Routing/nav:** `/pay-periods` is a first-class route (title handle "Pay periods"); the sidebar
  Planning item retargets and lights `aria-current`; `/insights/pay-periods` → `<Navigate replace>`
  and the Insights sub-nav drops the tab (retiring the UXR1 dual-highlight).
- **View:** two `.table-scroll` ledgers in a CSS grid (stacked ≤ 640px, Paychecks first); payday
  rows are `aria-pressed` toggle buttons whose selection highlight is **additive** over the
  permanent "Covered by" text column, announced via a polite `role="status"` line. The status badge
  carries S7 semantics exactly (running-headroom break → *Plan breaks here*/*Short*;
  over-committed-but-covered → *Over-committed*; else *Covered*). Shell owns the `<h1>`; the panes
  are the view's `<h2>`s.
- **Cockpit (Q4):** the Upcoming panel gains a **Next paycheck** deep-link line (date · committed ·
  headroom badge → `/pay-periods`), fed by one added `getPayPeriodPlan` call on the forecast
  account; degrades independently.
- **Gate:** typecheck · lint · format · unit · e2e · build · SCA green — **426 Vitest + 110 e2e**
  (+5 / +1); **web bundle 123.80 KB gz** (+1.29 vs 122.51; ~16 KB under the 140 KB budget). e2e
  re-pointed (`/pay-periods`, redirect, sidebar-active, axe light+dark, 320px reflow, cockpit
  deep-link).
