---
type: feature-spec
roadmap-item: BUD-S62
status: Implemented
---
<!--
FEATURE NOTE — roadmap S9 ("still owed this month"), from SPIKE-08 §6/§8: the sheet's D-column
remaining-obligations countdown, computed instead of hand-chained. §11 fast path: this note IS the
spec (small derived read on an existing panel; no schema, no API change, no spike — nothing here is
an unchecked assumption: the occurrence math is FEAT-009's proven engine). Pairs with the Upcoming
panel in docs/ux/cockpit.md §4.
-->

# Feature Note — "Still owed this month" (S9)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-S9                                                               |
| Status       | Implemented                                                           |
| Owner        | Wesley Cutting                                                        |
| Last updated | 2026-07-03                                                            |
| Related      | [SPIKE-08](../spikes/08-budgethome-sheet-analysis.md) §6 S9 · [Recurring](recurring.md) (FEAT-009) · [Cockpit UX](../ux/cockpit.md) §4 |

## What

The owner's sheet answers "from today to month-end, how much must I still have on hand for
bills?" with a fragile bottom-up running total (`D_n = D_{n+1} + C_n` over due-day-sorted rows).
Budgeteer computes it: **Still owed this month** = the sum over recurring **withdrawal** rules of
`amount × (unposted occurrences through the last day of the user's current local month)`, where
unposted occurrences start at each rule's `nextOccurrenceOn` cursor — the same cursor Post due
advances, so a posted bill drops out of the figure exactly when it becomes a real transaction.
Surfaced as a labelled figure on the cockpit's **Upcoming** panel.

Decisions (the sheet-fidelity calls):

- **Withdrawals only.** It's an obligations figure; deposits (paychecks) belong to the balance
  side, not the owed side — same as the sheet's D column (bills block only).
- **Past-due unposted occurrences count.** If a bill was due the 1st and hasn't posted, that money
  is still owed; the figure and the existing "N due to post" badge are complementary lenses on the
  same cursor (money vs. actions). Posting is what clears both.
- **Derived, client-side.** The cockpit's established pattern (R4/R5: compose existing reads, no
  new aggregate endpoint — net worth already derives from `listAccounts` in the component). The
  math is a pure `@budgeteer/domain` function over `listRecurring`'s existing fields; month-end
  comes from `dates.ts` (`localMonthRange().to`, EH8). No API, schema, or contract change.

## Acceptance criteria

1. Given withdrawal rules with unposted occurrences on/before the last day of the current local
   month (including past-due ones), the Upcoming panel shows **Still owed this month** = Σ
   (rule amount × occurrence count), formatted as money. Deposit rules contribute nothing.
2. A rule whose cursor is past month-end contributes 0; if nothing is owed the figure shows $0.00
   (a meaningful answer — everything through month-end is posted).
3. Posting due occurrences reduces the figure (cursor advance is the single source of truth).
4. The figure is text + structure (`<dl>` term/value like the panel's siblings) — never colour
   alone; axe-clean light + dark.

## UX states

Unchanged panel chrome (loading skeleton · inline error note · empty state when no rules — the
figure only renders when rules exist). Populated: the figure sits above the next-≤4-rules list.
