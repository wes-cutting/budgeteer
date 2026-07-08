<!--
FEATURE SPEC — roadmap S7 (pay-period planning), the last sheet-parity gap (SPIKE-08 §6 S7 + S8).
SPEC-FIRST per the roadmap: this document + docs/ux/pay-periods.md precede any code. Status is
Proposed — the §5 assignment policy is the unvalidated core; §9 names the cheap validation step
that must run before the build slice. Money + a candidate data-model fork ⇒ §11 ceremony held at
full weight (no compression).
-->

# Feature Spec — Pay-period planning ("which paycheck covers what")

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-S7                                                               |
| Status       | **Proposed** (assignment policy unvalidated — see §9)                 |
| Owner        | Wesley Cutting                                                        |
| Last updated | 2026-07-03                                                            |
| Related      | [SPIKE-08](../spikes/08-budgethome-sheet-analysis.md) §4–§6 (S7/S8) · [Recurring](recurring.md) (FEAT-009) · [Forecast](cash-flow-forecast.md) (FEAT-013, SPIKE-05 netting) · [FEAT-S9](still-owed.md) · [UX spec](../ux/pay-periods.md) |

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

## 5. The assignment policy (the core design decision — Proposed)

The sheet's bucket split is the owner's hand judgment (blue = due 1st–2nd, red = due 7th–30th,
whole clusters on alternating checks). A derived plan needs a deterministic rule. **Proposed
policy:**

> A bill occurrence is covered by the **latest expected paycheck dated at least `leadDays`
> before the bill's due date** (default `leadDays = 7`). Bills due sooner than `leadDays` after
> the first upcoming paycheck — or before it — are covered **from the current balance** (bucket
> zero). Deposits are never assigned; every recurring deposit occurrence on the account is an
> expected paycheck.

Properties: deterministic and order-independent; money always arrives ≥ `leadDays` before the
bill; a third monthly paycheck simply becomes a bucket like any other (it collects whatever
falls in its window — possibly nothing, which is the honest answer the sheet's ×2 rollup gets
wrong twice a year); the ~month-ahead reservation buffer emerges as **headroom** rather than
being hand-maintained.

**Known divergence from the sheet, flagged for review:** the sheet parks the entire 7th–30th
cluster on one check; this policy spreads those bills across the checks that precede them —
arguably sounder (each check carries roughly one period's obligations) but *different*. §9's
validation decides whether the divergence is acceptable or pulls §8 forward. `leadDays` is a
constant in V1 (no UI control) — tuning it is cheap once real output is visible.

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
2. Each bill is covered by the latest paycheck ≥ `leadDays` before its due date; bills with no
   such paycheck land in bucket zero.
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

## 9. Validation before build (Proposed → Validated)

Cheap and against reality, per ways-of-working §6: run the §5 policy **on the owner's live
rules** (the real store has the actual paycheck + bill cadence — S9's session verified figures
against it) for the next ~6 paychecks and compare with how the owner would bucket them today.
Agreement (or acceptable divergence) → `Validated`, build the slice; structural disagreement →
revisit `leadDays`/policy or pull §8 forward. This is a script-or-hand-simulation time-boxed to
an hour, not a formal spike.
