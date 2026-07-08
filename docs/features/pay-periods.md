<!--
FEATURE SPEC — roadmap S7 (pay-period planning), the last sheet-parity gap (SPIKE-08 §6 S7 + S8).
SPEC-FIRST per the roadmap: this document + docs/ux/pay-periods.md preceded any code. The §9
validation ran 2026-07-03 (SPIKE-10): it INVALIDATED the original date-only policy and replaced
§5 with the capacity-aware "balanced latest-fit" that survived the owner's real data. Money + a
candidate data-model fork ⇒ §11 ceremony held at full weight (no compression).
-->

# Feature Spec — Pay-period planning ("which paycheck covers what")

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-S7                                                               |
| Status       | **Implemented** (§9 ran against the sheet 2026-07-03, SPIKE-10; §5 revised to balanced latest-fit and built the same day, gate-green — the residual float divergence stays flagged in §5/SPIKE-10 §3.6 for owner ratification) |
| Owner        | Wesley Cutting                                                        |
| Last updated | 2026-07-03                                                            |
| Related      | [SPIKE-08](../spikes/08-budgethome-sheet-analysis.md) §4–§6 (S7/S8) · [SPIKE-10](../spikes/10-payperiod-policy-validation.md) (§9 validation) · [Recurring](recurring.md) (FEAT-009) · [Forecast](cash-flow-forecast.md) (FEAT-013, SPIKE-05 netting) · [FEAT-S9](still-owed.md) · [UX spec](../ux/pay-periods.md) |

## 1. Summary

The owner's sheet organizes money by **paycheck buckets**: every expected check is pre-committed
to a named cluster of future bills (~a month ahead), plus that period's variable spending, and a
running **headroom** line (`H = cash in − cumulative committed`) proves the plan stays viable.
Budgeteer's forecast times expenses at their **due dates**; nothing answers *"this paycheck must
cover: …"* or the stricter *"could I stop earning today and still cover everything already
promised?"* (SPIKE-08 S8). This capability adds a **derived pay-period plan**: expected income
occurrences become buckets, each bill occurrence is assigned to the paycheck that funds it, each
bucket totals its bills + planned spending, and a committed-at-payday headroom line runs down the
plan. **Derived-only V1: no schema change** — the plan is a pure function of what already exists
(recurring rules, targets, the derived balance).

## 2. Scope

- **In scope (V1)** — a read-only plan for one account: expected paychecks over a horizon; per
  paycheck: the bill occurrences it covers, a netted planned-spending line, the bucket total, and
  post-commitment headroom; a leading "from current balance" bucket for bills due before the first
  covered window; three-paycheck months handled by construction (§5); an explicit uncovered/
  broken-plan signal (§6).
- **Out of scope (V1)** — manually moving a bill between paychecks (**the assignment store — the
  recorded §11 scale-up, §8**); editing rules from this view; multi-account plans; notifications;
  any change to posting/forecast behavior.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the owner, I want each expected paycheck to show exactly which bills it must cover, so I can stop maintaining the sheet's J-column buckets by hand. | Must |
| US-2 | As the owner, I want a headroom line that commits money **at payday** (not at bill due date), so I can see whether everything already promised stays covered. | Must |
| US-3 | As the owner, I want the plan to keep working in three-paycheck months without a hardcoded ×2 assumption. | Must |
| US-4 | As the owner, I want per-period variable spending (the sheet's Food/Gas/Extras 2x · Debt 1x) folded into each bucket without double-counting scheduled bills. | Should |

## 4. Inputs (all existing)

Identical to the forecast's gather (analysisService): the account's **derived balance**, its
**recurring rules** (deposits = expected income; withdrawals = bills), **envelope monthly
targets**, **actual spend this month**, and `today` (required at the boundary, EH8). Occurrence
enumeration reuses `dueOccurrences`; expected discretionary spend reuses SPIKE-05's
**netting** (`target − actual − scheduled, floored at 0`) so a fully-scheduled envelope
contributes zero planned spending — the same anti-double-count rule the forecast proved.

## 5. The assignment policy (the core design decision — **Validated**, SPIKE-10)

The sheet's bucket split is the owner's hand judgment (blue = due 1st–2nd, red = due 7th–30th,
whole clusters on alternating checks). A derived plan needs a deterministic rule. **The policy
(balanced latest-fit):**

> Every recurring **deposit** occurrence on the account is an expected paycheck; deposits are
> never assigned. Each paycheck has a **capacity**: its deposit amount minus its planned-spending
> share (below). Bill occurrences are placed **largest amount first** (ties: earlier due date,
> then label) into the **latest expected paycheck dated at least `leadDays` (default 7) before
> the bill's due date that still has capacity remaining**. If every feasible paycheck is full,
> the bill falls back to the **latest feasible paycheck anyway** (an over-committed bucket —
> surfaced, never silent). Bills with no paycheck ≥ `leadDays` ahead of them are covered **from
> the current balance** (bucket zero).

Properties: deterministic (input order is irrelevant — the processing order is defined by the
rule); money always arrives ≥ `leadDays` before the bill; buckets stay load-balanced whenever a
balanced assignment exists (on the owner's real data: every bucket at 95–100% of its check,
exactly the sheet's hand balance — SPIKE-10 §3.5); horizon-stable (a bill's bucket depends on
its own neighborhood, not on how far out the plan runs); a third monthly paycheck simply becomes
a bucket like any other; the ~month-ahead reservation buffer emerges as **headroom** rather than
being hand-maintained. When capacity never binds, the rule reduces to the simple "latest check ≥
`leadDays` before due".

**History (SPIKE-10):** the originally-proposed date-only rule (latest check ≥ `leadDays`, no
capacity) was **invalidated** against the owner's real bills — due dates cluster at the month
boundary, so it parked ~149% of a check on the late-month paycheck while the mid-month one sat
at ~47%, and no constant `leadDays` fixes that (7/14/21 swept). Reservation-style earliest-fit
failed differently (horizon-dependent early hoarding). Capacity-awareness is what the owner's
hand method actually encodes.

**Residual divergence, owner-ratified at review:** the sheet pre-reserves whole clusters ~a
month out (its big 1st-of-month cluster gets 22–27 days of float); this policy guarantees only
≥ `leadDays` (that cluster gets 8–13 days) and mirror-balances membership rather than
cluster-parking. Loads and viability match the sheet; *which* check carries a specific bill may
not — wanting to pin one is §8's trigger, not a policy change. `leadDays` is a constant in V1
(no UI control).

**Planned spending per bucket (US-4):** each calendar month's netted residual (SPIKE-05) is
split evenly (`splitEvenly`) across the expected paychecks of that month and added to each
bucket — the derived form of "Food/Gas/Extras 2x" that also thins correctly in three-check
months. The sheet's "Debt 1x" is just an envelope target and needs no special case.

**Headroom (S8, folds in):** running from the current derived balance, at each paycheck:
`headroom_k = balance + Σ income_{≤k} − Σ committed_{≤k}` where a bucket's committed amount
lands **at its paycheck's date** (commitment time), not at bill due dates. Bucket zero commits
at `today`. Negative headroom at any bucket = "the plan breaks here" (text badge, §6 UX).

## 6. Vertical shape (V1)

- **Domain (pure):** `payPeriodPlan(...)` in `packages/domain` (new `payperiod.ts`), consuming
  the `ForecastRule`/`ForecastTarget` input shapes and reusing `dueOccurrences` +
  `expectedSpendEvents`'s netting; fully unit-tested with explicit dates (three-paycheck months,
  clamped month-ends, uncovered bills, negative headroom, zero-income, refund lines).
- **API:** `GET /api/analysis/pay-periods?accountId=…&today=…` (server **requires** `today`,
  EH8; horizon fixed at the forecast's 90-day default in V1) → `PayPeriodPlan` view assembled by
  `analysisService`; response type defined in the service and re-exported via
  `apps/api/src/contract.ts` (types-only; web `import type`s it — EH12/EH13).
- **Web:** new Insights tab **Pay periods** (`/insights/pay-periods`) per the UX spec; month-end
  and `today` derived via `dates.ts`.
- **No schema change; no migration.**

## 7. Acceptance criteria (map to tests)

1. Every future bill occurrence in the horizon appears in **exactly one** bucket (bucket zero or
   one paycheck); every expected paycheck in the horizon appears exactly once, in date order.
2. Each bill is covered by the latest paycheck ≥ `leadDays` before its due date **that has
   capacity remaining** (bills placed largest-first; ties by earlier due date, then label);
   when every feasible paycheck is full it lands on the latest feasible one and that bucket is
   marked **over-committed**; bills with no feasible paycheck land in bucket zero.
3. A month with three expected paychecks produces three buckets and splits that month's planned
   spending three ways (no ×2 assumption anywhere).
4. Bucket totals = Σ covered bills + planned-spending share; planned spending reuses the
   SPIKE-05 netting (a fully-scheduled envelope adds zero).
5. Headroom runs at commitment time: it equals balance + cumulative expected income − cumulative
   bucket totals, evaluated in bucket order; the first negative bucket is identified.
6. The endpoint 400s without `today`/`accountId`; unknown account 404s (default-deny unchanged).
7. The bucket join is text + structure (grouping + explicit dates/labels), never colour alone;
   the view is axe-clean light **and** dark, reflow-safe at 320px (UX15 table-scroll).

## 8. The recorded scale-up: an explicit assignment store

If the owner needs to **move** a bill between paychecks (validation may show the derived split
never matches how they actually juggle), V1's derived plan becomes the default and a
`bill↔paycheck` override store is added: a new table (frozen migration `0003-…` + registry +
`05_DATA_MODEL` in the same change), an ADR for the override semantics (what happens when the
overridden rule/occurrence changes or posts), and endpoint writes with boundary validation.
That is a §11 scale-up **decided by the §9 validation, not pre-built**.

## 9. Validation before build (Proposed → Validated) — **ran 2026-07-03, SPIKE-10**

The plan was to run the §5 policy on the owner's live rules; **reality check: the dev store has
no real bill cadence** (one demo paycheck rule + one subscription + `E2E ` fixtures), so the
validation ran against `BudgetHome.xlsx` itself — the sheet carries the actual biweekly paydays,
the 15 real bills, *and* the owner's own bucketing, making it the strictly better §9 baseline.
Outcome ([SPIKE-10](../spikes/10-payperiod-policy-validation.md)): **structural disagreement**
for the original date-only policy (buckets at ~149%/~47% of a check; no `leadDays` constant
helps) → per this section's own fork, the policy was revised rather than §8 pulled forward:
**balanced latest-fit** (§5) reproduces the sheet's load balance (95–100% per bucket, ≥ 7-day
float, ~19-day mean) on the real data. Residual divergence (float on the big month-boundary
cluster; mirror-balanced membership) is recorded in §5 and SPIKE-10 §3.6 for owner ratification;
wanting to pin a specific bill to a specific check remains §8's explicit trigger.
