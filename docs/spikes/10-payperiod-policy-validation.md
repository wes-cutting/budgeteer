<!--
SPIKE REPORT — the deliverable; the code was disposable (two Python scripts in the session
scratchpad: a read-only openpyxl extraction of BudgetHome.xlsx and an assignment-policy
simulator; both deleted with the scratchpad). See docs/00_WAYS_OF_WORKING.md §6.
-->

# SPIKE-10: Does FEAT-S7's assignment policy survive contact with the owner's real bills? (§9 validation)

| Field    | Value                                                                              |
| -------- | ----------------------------------------------------------------------------------- |
| Status   | Done                                                                                 |
| Type     | Value-hypothesis / policy validation (FEAT-S7 §9, run before any build code)         |
| Owner    | Wesley Cutting + agent                                                               |
| Time-box | ~1 h — honored                                                                       |
| Date     | 2026-07-03                                                                           |
| Blocks   | The S7 build slice (FEAT-S7 §6)                                                      |

> **Confidentiality (SPIKE-08 stance):** the workbook is the owner's live financial data and
> stays untracked. All amounts here are expressed in **income units** (1.000 = one paycheck);
> payee names are generalized to categories. Dates are kept — they are the mechanics.

## 1. The question

FEAT-S7 §5 proposed a derived bill↔paycheck assignment — *"a bill occurrence is covered by the
latest expected paycheck dated at least `leadDays` (7) before its due date"* — and §9 required
running it against the owner's real cadence and comparing with how the owner actually buckets
before building anything. **Does the policy produce the plan the owner runs by hand — or at
least a sound one?**

## 2. Method — and a finding about "the real store"

§9 assumed the dev store held the owner's live rules. **It does not**: the store's only
non-fixture rules are one *monthly* paycheck deposit and one small subscription (plus `E2E `
fixture pollution, K24) — no bill cadence at all. The genuine reality is `BudgetHome.xlsx`
(SPIKE-08), which carries the actual biweekly paydays, the 15 real monthly bills, **and** the
owner's own bucketing (the J-column blue/red assignments) — a better §9 baseline than the
store could ever be. So: read-only openpyxl extraction (SPIKE-08 precedent), then a
simulator applying each candidate policy to the extracted bills/paydays for the next 6
checks (today = 2026-07-03; paydays biweekly Fridays from 2026-07-10), compared per
occurrence against the sheet's J/L assignments.

The sheet's structure, in income units: a month-boundary cluster due the 1st–2nd totalling
**0.843** (dominated by one 0.428 housing bill), eleven bills due the 7th–30th totalling
**0.486**, per-month variable plan **0.653**. Monthly obligations ≈ **1.982** against income
2.000 — the owner's plan runs at ~99% utilization, and their hand buckets are almost perfectly
load-balanced: **0.986 / 0.995** of a check, alternating.

## 3. Findings

| # | Finding | Verdict |
| - | ------- | ------- |
| 1 | **The dev store lacks the owner's real cadence** — §9's "run against the live rules" premise was false; the sheet is the reality baseline. | Invalidated (assumption) |
| 2 | **The §5 policy as specced is structurally wrong on the real data.** Bills cluster at the month boundary; with biweekly checks, "latest check ≥ 7 days before due" parks the 1st–2nd cluster *and* the 7th–12th cluster on the same late-month check: buckets alternate **~0.47 / ~1.49** committed per 1.000 check. Agreement with the sheet: **18/51** occurrences. | **Invalidated** |
| 3 | **Tuning `leadDays` cannot fix it** (7/14/21 swept): every constant produces the same lumping, only shifted; leadDays=14 drives every bucket's headroom negative. §9's "tune leadDays" branch is closed. | Invalidated |
| 4 | **Reservation-style assignment (earliest feasible check, biggest first) is also unsound**: unbounded early reservation lets September's rent grab a late-July check (55-day float), overloading early buckets (1.09–1.49) and emptying the horizon edge; the result depends on the horizon. | Invalidated |
| 5 | **Balanced latest-fit works**: keep the latest-≥`leadDays` rule but make it capacity-aware — process bills largest-first (ties: earlier due date, then label) and place each into the **latest feasible check with remaining capacity** (capacity = that check's deposit − its planned-spending share − bills already placed); if no feasible check has room, fall back to the latest feasible check (visible over-commitment); no feasible check at all → bucket zero. On the real data every bucket lands at **0.95–1.00** of its check (the sheet's own balance), min float 7 d, mean ~19 d (the month-ahead buffer emerging), headroom essentially flat — matching the sheet's razor-thin H line, which is a property of the data (99% utilization), not the policy. Degrades to the original §5 rule exactly when capacity never binds. | **Confirmed** |
| 6 | **Residual divergence, for the owner to ratify**: the sheet gives the big 1st-of-month cluster ~22–27 days of float by pre-reserving a whole check; balanced latest-fit gives those bills ~8–13 days (≥ `leadDays` always) and mirror-balances membership (small bills early, big cluster late) instead of cluster-parking. Loads and viability match; *which* check carries the rent does not. If pinning specific bills matters, that is exactly FEAT-S7 §8's assignment store (the recorded scale-up), not a policy change. | Flagged |

## 4. Recommended decision

Adopt **balanced latest-fit** as FEAT-S7 §5 (done in the same change as this report), promote
FEAT-S7 + the UX spec to `Validated`, and build the V1 slice per FEAT-S7 §6 unchanged
(derived-only, no schema change). Surface over-commitment as a per-bucket text badge so the
overflow fallback is never silent. Keep §8 as the recorded scale-up, now with a sharper
trigger: *the owner wants a specific bill on a specific check* (e.g. rent on the earlier
check, sheet-style).

Also out of this spike: the dev store's demo-grade rules mean live verification of the S7
view shows one paycheck and one bill — fine for smoke, useless for judging the plan. Real
judgment happens when the owner enters their actual rules (the migration story) or via the
sheet-derived fixture in the domain tests.
