---
type: spike
id: SPIKE-08
roadmap-item: BUD-E9
status: Done
---
<!--
SPIKE REPORT
A spike is a time-boxed, throwaway investigation that answers ONE question against
reality before we commit to a spec/ADR or build on an assumption (see
docs/00_WAYS_OF_WORKING.md §6). The spike's CODE is disposable; this report is the
deliverable.
-->

# SPIKE-08: What does the owner's working sheet (`BudgetHome.xlsx`) do — and what maps to Budgeteer?

| Field    | Value                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| Status   | Done                                                                                |
| Type     | Artifact analysis / feature mapping                                                 |
| Owner    | Wesley Cutting                                                                      |
| Time-box | One session (read-only workbook analysis) — honored                                 |
| Date     | 2026-07-02                                                                          |
| Blocks   | Nothing (informational); candidate items in §8 are the owner's call                 |

> **Confidentiality:** the workbook is the owner's **live financial data**. The file itself is
> untracked and gitignored (`*.xlsx`); this report keeps it that way — **all dollar amounts are
> redacted to placeholders and creditor/payee names are generalized to categories**
> (SECURITY.md §1; same stance as SPIKE-01's synthetic figures). Cell references, formulas
> (with constants elided), colors, and borders are documented faithfully — they are the
> mechanics, not the data.
>
> **This is not the 12-year history file.** `BudgetHome.xlsx` is the owner's *current working
> planner* (one sheet, one screen). The deferred SPIKE-03 / roadmap `#17`–`#18`
> (data-profiling + historical import of the long-lived `Budget.xlsx`) remains separately
> gated and is **not** retired by this analysis — though §7's fragility notes preview exactly
> the "in-cell formula strings" problems SPIKE-03 anticipates.

## 1. The question

The owner still runs a hand-built spreadsheet alongside Budgeteer. **What does that sheet
actually do — its formula flow and its color/border language — and which of its features does
Budgeteer already cover, partially cover, or lack?** The gaps are candidate roadmap items;
the covered set is the migration story.

## 2. Method

Read-only inspection with `openpyxl` (values + formulas + fills/borders/fonts + conditional
formatting + validations; none of the latter two exist in the file). One visible sheet,
`Budget`, spanning `A1:L24` — small enough to read exhaustively. No modification, no
recalculation, nothing written back.

## 3. The sheet at a glance

One screen, **three functional blocks plus one input constant**, wired left-to-right:

```
      A          B       C        D          F          G         H          J             K          L
 1                                        INCOME    =⟨check⟩*2
 2  Monthlies  Dates    Cost    Total     PayDay    Balance    Funds    PayPeriod Exp.  (cum.)
 3  bill₁      1st     ⟨$⟩ ▓C   =D4+C3    wk 0 🟨   =⟨start⟩   =G3-K3                   =L2+J3
 4  bill₂      1st     ⟨$⟩ ▓C   =D5+C4    wk 1      =G3        =G4-K4                   =K3+J4
 5  bill₃      1st     ⟨$⟩ ▓C   =D6+C5    wk 2 🟨   =G4+G$1    =G5-K5   =Σ(C3:C6)+Σ(C20:C22) ┃blue  =K4+J5   Aug
 6  bill₄      2nd     ⟨$⟩ ▓C   =D7+C6    wk 3      =G5        =G6-K6                   =K5+J6
 7  bill₅      7th     ⟨$⟩ ▓Y   =D8+C7    wk 4 🟨   =G6+G$1    =G7-K7   =Σ(C7:C17)+Σ(C20:C23) ┃red  =K6+J7   Aug
 ⋮   (15 bill rows, sorted by due day; fills band them: ▓Cyan 1st–2nd · ▓Yellow 7th–12th
      · ▓Slate 15th–22nd · ▓Green 29th–30th; thick BLUE border boxes C3:C6, RED boxes C7:C17)
18  SubTotal          =SUM(C3:C17)        (…the F/G/H/J/K/L columns continue: one row per WEEK,
19  Remaing           =(G1*2)-C18          🟨 gold fill = payday every 2nd row, J alternating
20  Food       2x     ⟨$⟩                  blue/red bucket every payday, L = month label…)
21  Gas        2x     ⟨$⟩
22  Extras     2x     ⟨$⟩
23  Debt       1x     ⟨$⟩
24                    =SUM(C20:C23)+SUM(C20:C22)
```

- **Block A — recurring-bill register + monthly rollups** (`A2:D19`)
- **Block B — variable-spend plan** (`A20:C24`)
- **Block C — weekly cash-flow forecast with paycheck buckets** (`F2:L24`)
- **Input constant** — `G1 = ⟨per-check amount⟩*2` labeled `INCOME` (`F1`): the money that
  arrives per payday, itself a formula (two checks per pay event).

## 4. Formula flow, block by block

### Block A — the recurring-bill register (`A2:D19`)

| Col | Header | Content |
| --- | ------ | ------- |
| A | `Monthlies` | Bill name (15 rows, r3–r17) — mortgage/rent/storage-class housing bills, several loan payments, utilities, telecom, subscriptions |
| B | `Dates` | Due **day-of-month as text** (`'1st'`, `'7th'`, `'21st'`…) — rows are sorted by it |
| C | `Cost` | The monthly amount (plain number, `General` format — no currency formatting anywhere) |
| D | `Total` | `D_n = D_{n+1} + C_n` — a **bottom-up running total** |

The D column is the subtle one: it accumulates **upward from the last bill**, so read
top-down it answers *"from this bill to the end of the month, how much is still owed?"*
(`D3` = the whole month; `D17` = just the last bill; the recursion bottoms out on the empty
`D18`). Because rows are sorted by due day, D is a **remaining-obligations countdown**: find
today's row, and D tells you the cash you must still have on hand for the rest of the
month's bills.

Two rollups close the block:

- `C18 SubTotal = SUM(C3:C17)` — total monthly recurring bills.
- `C19 "Remaing" = (G1*2) − C18` — **monthly discretionary income**: two paydays' income
  minus the bills. (Note the hardcoded ×2-paydays-per-month assumption — see §7.)

### Block B — the variable-spend plan (`A20:C24`)

Four planned envelopes with a **cadence marker** in B: `Food 2x`, `Gas 2x`, `Extras 2x`
(funded every pay period, i.e. twice monthly) and `Debt 1x` (an extra debt paydown once a
month). The unlabeled `C24 = SUM(C20:C23) + SUM(C20:C22)` computes the true monthly total by
counting the `2x` trio twice and `Debt` once — the cadence is *encoded in the formula shape*,
not in data.

### Block C — the weekly forecast with paycheck buckets (`F2:L24`)

One row per **week** (`F` holds text pseudo-dates 7 days apart), five columns of machinery:

| Col | Header | Formula pattern | What it does |
| --- | ------ | --------------- | ------------ |
| F | `PayDay` | text dates; **gold fill every 2nd row** | The calendar spine; gold = a biweekly payday |
| G | `Balance` | payday rows: `=G_{prev}+G$1` · off weeks: `=G_{prev}`; `G3 = ⟨starting balance⟩` | Projected **cash in**: starting balance stepped up by one income constant per payday |
| J | `PayPeriod Expenses` | alternates: `=SUM(C3:C6)+SUM(C20:C22)` (blue-bordered) ↔ `=SUM(C7:C17)+SUM(C20:C23)` (red-bordered), one per payday row | The **paycheck bucket**: each check is pre-assigned one bill *cluster* plus that period's variable trio (the red bucket also carries the monthly `Debt` extra) |
| K | (unlabeled) | `K_n = K_{n-1} + J_n` (seed `K3 = L2 + J3` — both empty, a stale leftover) | **Cumulative committed obligations** to date |
| H | `Funds` | `H_n = G_n − K_n` | **Headroom**: cash in minus obligations committed so far — the viability line; if H goes negative, the plan breaks. Pale-yellow zebra on off-week rows |
| L | (unlabeled) | month names beside each bucket row | Which month's bills that bucket reserves |

The bucket assignment is the sheet's core methodology. The `L` labels show each paycheck
funds bills due **weeks later**: a mid-July check reserves August's 1st-of-month cluster;
the late-July check reserves August's 7th–30th cluster; the early-August check reserves
September's 1st cluster — and so on, alternating blue/red. The owner runs **roughly a
month ahead**: every incoming check is immediately committed (via `K`) to a named future
cluster, and `H` proves the balance always covers everything committed. Income arrives
biweekly, bills cluster at month boundaries — the sheet's whole job is bridging that
cadence mismatch.

## 5. The visual language

The formatting is not decoration — it is a **join system** linking data ranges to formulas:

| Signal | Where | Meaning |
| ------ | ----- | ------- |
| **Thick BLUE border** boxing `C3:C6` | Cost cells of bills due the 1st–2nd | Membership in the **blue paycheck bucket** — the same thick blue border wraps every `J` cell whose formula is `SUM(C3:C6)+…`. **Border color is the visual join key between a bucket formula and its source range.** |
| **Thick RED border** boxing `C7:C17` | Cost cells of bills due the 7th–30th | Membership in the **red paycheck bucket**; likewise mirrored on the red-bordered `J` cells (`SUM(C7:C17)+…`) |
| **Cyan fill** `C3:C6` | due 1st–2nd | Due-day **timing band** 1 (month start) |
| **Pale-yellow fill** `C7:C11` | due 7th–12th | Timing band 2 (early-mid) |
| **Slate fill** `C12:C14` | due 15th–22nd | Timing band 3 (mid-late) |
| **Green fill** `C15:C17` | due 29th–30th | Timing band 4 (month end) |
| **Gold fill** on `F` rows (every 2nd row) | payday weeks | **Income arrives here** — visually aligns with the `+G$1` steps in `G` and the bucket formulas in `J` |
| **Pale-yellow zebra** on `H` off-week rows | non-payday weeks | Row-pairing/readability stripe: each payday row and its following off week read as one pay period |

Two observations that matter for the mapping:

- The **fills subdivide the red bucket** into *when-in-the-month* bands — a second, finer
  grouping the formulas don't use. It's the owner's at-a-glance answer to "what hits next
  week?"
- **Color is the only signal for all of it.** No labels, no legend, nothing machine-readable
  — precisely the encoding Budgeteer's standards forbid (WCAG 1.4.1 "never colour alone",
  enforced since UX8/UX13). Any Budgeteer equivalent must carry these meanings in text +
  structure, not paint.

## 6. Feature → Budgeteer mapping

| # | Sheet feature | Mechanism in the sheet | Budgeteer equivalent | Status |
| - | ------------- | ---------------------- | -------------------- | ------ |
| S1 | Recurring-bill register (name · due day · amount) | Rows `A3:C17` | Recurring rules (FEAT-009): account, direction, magnitude, `weekly/biweekly/monthly` + anchor date, split lines | **Covered** — monthly-anchored rules express day-of-month; the register is `/recurring` |
| S2 | Fixed biweekly income | `G1 = ⟨check⟩*2`, stepped into `G` every 2nd week | A `biweekly` recurring **deposit** rule | **Covered** |
| S3 | Weekly balance projection | `G` column recurrence | Cash-flow forecast (FEAT-013): event-stepped projection from the recurring engine, per account, 90-day default | **Covered** — and Budgeteer's version starts from the *reconciled actual* balance, not a hand-typed `⟨start⟩` |
| S4 | Variable per-period spend plan (`Food/Gas/Extras 2x`, `Debt 1x`) | Block B + inclusion in every `J` bucket | Envelope monthly targets (FEAT-012) + the forecast's **expected-spend netting** (SPIKE-05 proved the no-double-count model) | **Covered** — cadence is monthly rather than per-paycheck, a presentational difference given S7 |
| S5 | Monthly discretionary rollup (`Remaing = income − bills`) | `C19` | Budget-vs-actual (FEAT-012) + the cockpit budget-health panel (UX5/UX13) | **Covered** — and computed from actuals, not a ×2-paydays assumption |
| S6 | Extra-debt paydown plan + effect | `Debt 1x` row; effect invisible (no balances) | Debt payoff % + trend (FEAT-014b), credit utilization (FEAT-014a) | **Covered & richer** — the sheet plans the payment; Budgeteer also shows the consequence |
| S7 | **Paycheck-bucket planning** — every check pre-assigned a named bill cluster ~a month ahead; the blue/red border join | `J` alternation + border joins + `L` month labels | **None.** The forecast steps expenses at their *due dates*; nothing assigns obligations to a specific expected income event or shows "this paycheck must cover: …" | **GAP** — the sheet's core organizing idea |
| S8 | **Committed-obligations headroom** (`H = balance − cumulative committed`) | `K` accumulates buckets **at payday**; `H` is the viability line | Partial: the forecast's projected-balance line carries equivalent information but times expenses at **due date**, not at **commitment**. The sheet's stricter lens ("could I stop earning today and still cover everything already promised?") has no surface | **Partial** — subsumed by S7 if built |
| S9 | **Remaining-obligations countdown** (`D` bottom-up running total) | `D_n = D_{n+1} + C_n` over due-day-sorted rows | Partial: the cockpit's upcoming-recurring panel lists what's due; nothing totals "still owed from today to month-end" | **Partial** — a small derived read (sum of not-yet-posted occurrences this month) |
| S10 | Due-day **timing bands** (the four fills) | Fill grouping on `C` | The upcoming-recurring list is date-sorted, which conveys the same ordering textually | **Covered in spirit** — no banding, but the information survives |
| S11 | The color/border join language itself | §5 | Deliberately **not** replicable as-is (colour-only encoding); Budgeteer carries state in text + structure per ADR-0007/UX13 conventions | **Superseded** by design |

**And the reverse mapping — what the sheet cannot do that Budgeteer already does:** no
actuals (it is a plan with no ledger — nothing records what *really* happened), no split
allocation, no refunds, no reconciliation against the bank, single account, no history or
trends, balances hand-seeded rather than derived, and every invariant unchecked (see §7).
The migration story is: Budgeteer replaces the sheet's bookkeeping wholesale; the genuine
losses today are S7/S8/S9.

## 7. Fragilities observed (why the sheet needs replacing — and a SPIKE-03 preview)

Documented as evidence, not criticism — each is a class of defect Budgeteer's design already
eliminates, and several preview exactly the extraction hazards SPIKE-03 (#17) anticipates in
the 12-year file:

1. **Dates are prose.** `'June 26th'`, `'1st'`, `'2x'` — nothing is a real date; the weekly
   spine and due days can't be computed against, only eyeballed. (Budgeteer: `YYYY-MM-DD`
   throughout.)
2. **Money is `General`-formatted floats** with constants buried in formulas: the income is
   `=⟨amount⟩*2`, the starting balance `=⟨amount⟩` — data hiding inside formula strings, the
   precise SPIKE-03 problem. (Budgeteer: integer cents, ADR-0003.)
3. **The bucket ranges are hardcoded** (`SUM(C3:C6)`, `SUM(C7:C17)` repeated down `J`).
   Inserting a bill row mid-range silently corrupts *every future pay period* — the
   classic spreadsheet failure. (Budgeteer: allocations are rows, sums are derived.)
4. **A stale seed:** `K3 = L2 + J3` references two empty cells — a fossil of a previous
   layout that happens to evaluate to 0. Nothing would flag it if `L2` gained a value.
5. **The ×2-paydays assumption:** `C19 = (G1*2) − C18` prices the month at exactly two
   checks, while the `F` spine is truly weekly-with-biweekly-pay — so **three-paycheck
   months exist in Block C but not in Block A's rollup**. The two blocks quietly disagree
   twice a year. (Budgeteer's forecast steps real occurrences; no such assumption.)
6. Cosmetic but telling: the `Remaing` typo, the unlabeled `C24`/`K`, and a meaning system
   (§5) that lives entirely in the owner's head — colour-only, legend-free, and invisible
   to any assistive technology.

## 8. Candidate roadmap items (owner's call — none blocking)

- **S7 — Pay-period planning ("which paycheck covers what")**: the one genuine feature gap.
  A view that assigns recurring rules (and per-period envelope funding) to expected income
  occurrences, shows each paycheck's bucket total, and carries the sheet's month-ahead
  reservation buffer — with the blue/red join expressed as text/structure, never colour
  alone. Would warrant a feature spec + UX spec; it touches no schema initially (derivable
  from recurring rules + targets) but an explicit bill↔paycheck assignment would need a
  small store, so scope it deliberately (§11 ceremony scale-up if a store is added).
- **S9 — "Still owed this month" figure**: a small derived read (unposted recurring
  occurrences through month-end, summed) surfaced on the cockpit's upcoming-recurring panel
  — the D column's countdown, computed instead of hand-chained.
- **S8 folds into S7** (the headroom line is the bucket view's bottom row); S1–S6, S10 need
  nothing — they are the migration pitch, already shipped.

## 9. Relationship to the deferred history work

Unchanged: SPIKE-03 (#17, profiling the 12-year `Budget.xlsx`) and #18 (historical import)
stay deferred and are not advanced by this report — but §7 items 1–3 are a live preview of
that file's extraction hazards, observed in the owner's *current* formula habits. When
SPIKE-03 runs, expect prose dates, constants-in-formulas, and hardcoded ranges as the
dominant cleaning work.
