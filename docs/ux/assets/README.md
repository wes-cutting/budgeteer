# UX reference assets

Reference images the UX specs link to (design-session screenshots, mockups).

Expected drops from the 2026-07-06 UX-redesign session:

- `2026-07-06-dashboard-reference.png` — the "Efferd" dashboard screenshot the
  [UX Redesign initiative](../../reviews/2026-07-06-ux-redesign-initiative.md) and
  [UXR1 sidebar-shell spec](../app-shell-sidebar.md) reference. Synthetic SaaS content —
  fine to commit.
- `2026-07-06-payperiod-sheet-reference.png` — the owner's `BudgetHome.xlsx` pay-period view
  referenced by the [UXR2 planner spec](../pay-periods-planner.md). **Contains real financial
  data (creditors, amounts, income) — gitignored by name; NEVER commit it**
  (docs/SECURITY.md; the SPIKE-08 redaction stance).

Anything else with real financial data follows the same rule: keep it local, add it to
`.gitignore` by name, note it here.
