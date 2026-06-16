<!--
FEATURE SPEC — #11: analysis, spend by envelope over time (monthly grid + annual rollup).
The first analysis slice; replaces the legacy hand-keyed "18 Monthly" tab with a GENERATED
view derived from real allocation data. Pairs with docs/ux/analysis-envelope-spend.md.
-->

# Feature Spec — Analysis: spend by envelope over time

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-011                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-15                             |
| Related      | [Transactions](transactions.md) (FEAT-003) · [Envelopes](envelopes.md) (FEAT-002) · [Transfers](transfers.md) (FEAT-007) · [UX](../ux/analysis-envelope-spend.md) · [Domain](../04_DOMAIN_MODEL.md) · [API](../06_API_CONTRACT.md) · PRD §6 (journey 9), §7 (scope 6) |

## 1. Summary

A **generated** rollup of how money flowed through each envelope over time — the direct
replacement for the spreadsheet's hand-keyed **"18 Monthly"** tab. Rows are envelopes, columns
are periods (months, with an annual rollup), and each cell is the **net signed allocation flow**
for that envelope in that period: the sum of the envelope's allocation amounts whose transaction
fell in the period. Because allocations are already signed (a deposit's slice is `+` = funded, a
withdrawal's is `−` = spent, a refund flips), a cell reads naturally: **positive = net funded,
negative = net spent**. This is the first slice of the analysis area (#11–#14) and the first view
in Budgeteer that is *computed*, not entered.

## 2. Scope

- **In scope** — a monthly grid (envelope × month) of net allocation flow; an **annual** rollup
  (envelope × year) via a grain toggle; per-envelope **row totals** and per-period **column
  totals**; **archived** envelopes included (their history is preserved); read-only.
- **Out of scope** — **envelope↔envelope reallocations** are **excluded** (they are internal
  rebudgeting, not income/spend — owner decision, see §11); a continuous/gap-filled period axis
  (only periods that have activity are shown — a fast-follow); budget-vs-actual targets (#12);
  date-range filtering, CSV export, charts (later); cash-flow forecast (#13); debt/credit (#14).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to see how much I spent from / funded each envelope each month so I can see where the money went. | Must |
| US-2 | As the user, I want an annual rollup so I can see the year at a glance. | Should |
| US-3 | As the user, I want per-envelope and per-month totals so the grid foots like the spreadsheet did. | Should |
| US-4 | As the user, I want archived envelopes still counted in history so past months stay truthful. | Should |

## 4. Acceptance criteria

- **Given** a Groceries envelope **funded** `+$500.00` (a deposit allocation) and **spent**
  `−$560.00` (a withdrawal allocation), both in March 2026, **when** I view the **monthly** grid,
  **then** the `Groceries × 2026-03` cell shows **−$60.00** (net = funded − spent), and — if that's
  the only period — the Groceries **row total** is `−$60.00`.
- **Given** allocations across **2026-03** and **2026-04**, **then** the grid has a column for each
  period (ascending), each envelope row has a value per period (0 where it had no flow), and the
  **column total** for a period equals the sum of that column.
- **Given** the same data, **when** I switch the grain to **annual**, **then** the columns collapse
  to years (e.g. `2026`) and each cell is that envelope's net flow for the year.
- **Given** an envelope↔envelope **reallocation** of `$100.00`, **then** the rollup numbers are
  **unchanged** (reallocations are excluded).
- **Given** an **archived** envelope with past allocations, **then** it still appears (flagged
  archived) with its historical flow.
- **Given** no allocations exist at all, **then** the view shows an **empty state** (no rows).
- **Invalid** grain (not `month`/`year`) → `400`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Envelope with no allocation flow | Omitted from the grid (keeps it focused; zero-only rows add noise). |
| Period with flow that nets to 0 | Still shown (the column exists; the cell shows `$0.00`). |
| Opening-balance allocations | Counted — an opening transaction's allocations are real envelope funding, bucketed by its `occurred_on`. |
| Transfer legs | Naturally absent — transfer legs carry **no** allocations (ADR-0004). |
| Refund rows | Counted with their stored sign (a refund is `+` within a withdrawal), so a refunded month nets higher. |
| Sparse / gap months | Only periods with activity become columns (no empty interleaving months in V1). |

## 6. Data changes

**None.** No new table, no new view, no migration. The rollup is a **read-only aggregate query**
over existing `allocations` ⋈ `transactions` ⋈ `envelopes` (period via `to_char(occurred_on, …)`,
household-scoped on the transaction). Money stays **integer cents** end to end — summed in SQL,
narrowed to a JS `number` at the read boundary (the `bigint`→`Number` convention,
[05_DATA_MODEL](../05_DATA_MODEL.md) §1), formatted only at the UI. See the read-path note in
[05_DATA_MODEL](../05_DATA_MODEL.md) §4.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):
- `GET /analysis/envelope-spend?grain=month|year` (default `month`) → `200 { rollup }`.

```
EnvelopeSpendRollup = {
  grain: "month" | "year";
  periods: string[];               // ascending; "YYYY-MM" (month) or "YYYY" (year)
  rows: EnvelopeSpendRow[];        // one per envelope WITH activity, ordered by name
  periodTotals: number[];          // column sums, aligned to periods (signed cents)
  grandTotal: number;              // Σ all cells (signed cents)
}
EnvelopeSpendRow = {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  amounts: number[];               // aligned to periods; signed cents; 0 where no flow
  total: number;                   // row sum (signed cents)
}
```

UI: a new **Analysis** view (reached from a Dashboard button), with a **grain toggle**
(Monthly / Annual) and a grid table — see [UX](../ux/analysis-envelope-spend.md).

## 8. Dependencies

Real transaction/allocation data from the core loop (FEAT-003), which exists. Reuses
`util/groupBy` + `util/dates` (EH2), the web `formatCents` display formatter (EH1), and the
zod-at-boundary + `{ error: { message } }` envelope (house style). No domain changes — allocations
already carry the sign the rollup needs.

## 9. Security, privacy & accessibility

Household-scoped server-side (`DEFAULT_HOUSEHOLD_ID` on the transaction); the only input, `grain`,
is validated at the boundary (closed enum → `400` otherwise). Read-only; no secrets/real data
(tests use synthetic fixtures). The view is a real `<table>` with a `<caption>`, `scope="col"`
period headers and `scope="row"` envelope headers, and a totals `<tfoot>`; negative values are
conveyed as text (`-$…`), never by color alone (WCAG 2.2 AA). Loading/empty/error states are
text with `role="status"`/`role="alert"`.

## 10. Test plan

- **Unit (domain):** none — the slice adds **no** pure money logic (allocations are pre-signed;
  the sum is done in SQL). Stated explicitly so the absence is deliberate, not an oversight.
- **Integration (API):** monthly grid (signed net per cell, ascending periods, row + column +
  grand totals, 0-fill); annual grid; **reallocations excluded** (an `envelope_transfer` doesn't
  move the numbers); **archived** envelope still present; opening-balance allocations counted;
  empty state (`rows: []`, `periods: []`); bad grain → `400`; cent-exactness.
- **Component (web):** the grid renders rows/cells/totals from a fake API; the grain toggle
  reloads; empty and error states; `formatCents` display.
- **e2e:** the existing single Playwright journey stays green; a dedicated analysis e2e is folded
  into the consolidated full-journey pass (**#16**, per EH5's scoping).

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| ~~Net signed flow per cell, or split spent/funded columns?~~ | Wesley | **resolved: net signed flow** (one number per cell) |
| ~~Do envelope↔envelope reallocations count in the rollup?~~ | Wesley | **resolved: exclude** (real transaction flow only) |
| ~~Grain — monthly, annual, both?~~ | Wesley | **resolved: monthly grid + annual rollup** |
| Fill gap periods so the month axis is continuous? | Wesley | open (V1: only periods with activity) |
| Add date-range filtering / CSV export / charts? | Wesley | open (later in the analysis area) |
