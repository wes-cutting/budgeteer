<!--
Artifact crosswalk — Follow-up B of the 2026-07-12 restructure initiative, now GENERATED
FROM DOC FRONTMATTER (K30 Part A) by scripts/check-docs.ts. Each artifact declares its own
type/roadmap-item/status; this file is regenerated from that (`npm run docs:crosswalk`) and
validated in the gate (`npm run docs:check`). Do not hand-edit. Id metadata from 03_ROADMAP-v2.md §2.
-->

# Artifact crosswalk — reports · spikes · specs ↔ BUD-* ids

| Field   | Value          |
| ------- | -------------- |
| Status  | Generated (do not hand-edit — `npm run docs:crosswalk`) |
| Owner   | Wesley Cutting |
| Date    | 2026-07-12     |
| Parent  | [2026-07-12 restructure initiative](2026-07-12-roadmap-restructure-initiative.md) (Follow-up B) |
| Source  | **doc frontmatter** (`type` · `roadmap-item` · `status`) across `status-reports/ · spikes/ · features/ · ux/`; id metadata from [`03_ROADMAP-v2.md`](../03_ROADMAP-v2.md) §2 |

## What this is

The back-reference bridge, **self-describing and generated**: every artifact carries
`roadmap-item:` frontmatter (K30 Part A), so this index is *derived from the docs themselves*.
Add a doc with correct frontmatter and it appears here on the next `npm run docs:crosswalk`;
`npm run docs:check` (in the gate) fails if any artifact's frontmatter is missing/dangling or
if this file drifts from the docs.

**Additive/reversible:** the artifact files keep their legacy names and old-id headers; only a
small frontmatter block was prepended. Filename/id renames stay a **cutover** task.

## 1. Forward — each roadmap item → its artifacts

| New ID | Was | Title | Feature/UX spec | Spike | Status report(s) |
| --- | --- | --- | --- | --- | --- |
| `BUD-E9` | `—` | Sheet parity | — | [08-budgethome-sheet-analysis.md](../spikes/08-budgethome-sheet-analysis.md) | — |
| `BUD-E10` | `—` | UX Redesign | — | — | [2026-07-07-uxr-scoping.md](../status-reports/2026-07-07-uxr-scoping.md) |
| `BUD-S1` | `#1` | Foundation | [accounts.md](../features/accounts.md) · [envelopes.md](../features/envelopes.md) · [foundation.md](../ux/foundation.md) | — | [2026-06-13-foundation-slice.md](../status-reports/2026-06-13-foundation-slice.md) |
| `BUD-S2` | `#3` | core enter→allocate loop — enter deposit/withdrawal → allocate in Sing… | [transactions.md](../features/transactions.md) · [transactions.md](../ux/transactions.md) | — | [2026-06-13-slice-1.md](../status-reports/2026-06-13-slice-1.md) |
| `BUD-S3` | `#4` | accelerators — templates/presets | [templates.md](../features/templates.md) · [templates.md](../ux/templates.md) | [01-split-allocation-ux.md](../spikes/01-split-allocation-ux.md) | [2026-06-13-slice-2.md](../status-reports/2026-06-13-slice-2.md) |
| `BUD-S4` | `#5` | Edit a past split | [edit-split.md](../features/edit-split.md) · [edit-split.md](../ux/edit-split.md) | — | [2026-06-13-slice-5.md](../status-reports/2026-06-13-slice-5.md) |
| `BUD-S5` | `#6` | Archive an envelope | [archive-envelope.md](../features/archive-envelope.md) · [archive-envelope.md](../ux/archive-envelope.md) | — | [2026-06-13-slice-6.md](../status-reports/2026-06-13-slice-6.md) |
| `BUD-S6` | `#7a` | Transfer | [transfers.md](../features/transfers.md) · [transfers.md](../ux/transfers.md) | — | [2026-06-14-slice-7a.md](../status-reports/2026-06-14-slice-7a.md) |
| `BUD-S7` | `#7b` | Reallocation | [transfers.md](../features/transfers.md) · [transfers.md](../ux/transfers.md) | — | [2026-06-14-slice-7b.md](../status-reports/2026-06-14-slice-7b.md) |
| `BUD-S8` | `#8` | Refunds | [refunds.md](../features/refunds.md) · [refunds.md](../ux/refunds.md) | — | [2026-06-14-slice-8.md](../status-reports/2026-06-14-slice-8.md) |
| `BUD-S9` | `#9` | Recurring transactions | [recurring.md](../features/recurring.md) · [recurring.md](../ux/recurring.md) | — | [2026-06-14-slice-9.md](../status-reports/2026-06-14-slice-9.md) |
| `BUD-S10` | `#10` | Reconcile to bank | [reconcile.md](../features/reconcile.md) · [reconcile.md](../ux/reconcile.md) | — | [2026-06-15-slice-10.md](../status-reports/2026-06-15-slice-10.md) |
| `BUD-S11` | `R6` | Transaction delete | — | — | [2026-06-21-r6.md](../status-reports/2026-06-21-r6.md) |
| `BUD-S12` | `R7` | Account archive / close | — | — | [2026-06-21-r7.md](../status-reports/2026-06-21-r7.md) |
| `BUD-S13` | `R8` | Transaction search / filter | — | — | [2026-06-22-r8.md](../status-reports/2026-06-22-r8.md) |
| `BUD-S14` | `R15` | Envelope ledger | [envelope-ledger.md](../features/envelope-ledger.md) · [envelope-ledger.md](../ux/envelope-ledger.md) | — | [2026-06-21-r15.md](../status-reports/2026-06-21-r15.md) |
| `BUD-S15` | `#11` | spend by envelope over time | [analysis-envelope-spend.md](../features/analysis-envelope-spend.md) · [analysis-envelope-spend.md](../ux/analysis-envelope-spend.md) | — | [2026-06-15-slice-11.md](../status-reports/2026-06-15-slice-11.md) |
| `BUD-S16` | `#12` | budget vs. actual | [budget-vs-actual.md](../features/budget-vs-actual.md) · [budget-vs-actual.md](../ux/budget-vs-actual.md) | — | [2026-06-16-slice-12.md](../status-reports/2026-06-16-slice-12.md) |
| `BUD-S17` | `#13` | cash-flow forecast | [cash-flow-forecast.md](../features/cash-flow-forecast.md) · [cash-flow-forecast.md](../ux/cash-flow-forecast.md) | [05-cashflow-forecast.md](../spikes/05-cashflow-forecast.md) | [2026-06-16-slice-13.md](../status-reports/2026-06-16-slice-13.md) |
| `BUD-S18` | `#14a` | credit utilization | [credit-utilization.md](../features/credit-utilization.md) · [credit-utilization.md](../ux/credit-utilization.md) | — | [2026-06-16-slice-14a.md](../status-reports/2026-06-16-slice-14a.md) |
| `BUD-S19` | `#14b` | debt payoff % | [debt-payoff.md](../features/debt-payoff.md) · [debt-payoff.md](../ux/debt-payoff.md) | — | [2026-06-16-slice-14b.md](../status-reports/2026-06-16-slice-14b.md) |
| `BUD-S20` | `R9` | Net worth over time analysis | — | — | [2026-06-22-r9.md](../status-reports/2026-06-22-r9.md) |
| `BUD-S21` | `R4` | Dashboard net worth summary | — | — | [2026-06-22-r4.md](../status-reports/2026-06-22-r4.md) |
| `BUD-S22` | `EH1` | Share the domain in the web | — | — | [2026-06-15-eh1.md](../status-reports/2026-06-15-eh1.md) |
| `BUD-S23` | `EH2` | Extract API service plumbing | — | — | [2026-06-15-eh2.md](../status-reports/2026-06-15-eh2.md) |
| `BUD-S24` | `EH3` | Map DB unique-violation → 409 | — | — | [2026-06-15-eh3.md](../status-reports/2026-06-15-eh3.md) |
| `BUD-S25` | `EH4` | Add ESLint to the gate | — | — | [2026-06-15-eh4.md](../status-reports/2026-06-15-eh4.md) |
| `BUD-S26` | `EH5` | Browser e2e | — | — | [2026-06-15-eh5.md](../status-reports/2026-06-15-eh5.md) |
| `BUD-S27` | `EH6` | Repo hygiene | — | [04-transfer-modeling.md](../spikes/04-transfer-modeling.md) | [2026-06-15-eh6.md](../status-reports/2026-06-15-eh6.md) |
| `BUD-S28` | `EH7` | Inject the clock into services | — | — | [2026-07-02-eh7.md](../status-reports/2026-07-02-eh7.md) |
| `BUD-S29` | `EH8` | Decide + document the timezone policy | — | — | [2026-07-03-eh8.md](../status-reports/2026-07-03-eh8.md) |
| `BUD-S30` | `EH9` | Versioned migrator | — | — | [2026-07-03-eh9-eh14.md](../status-reports/2026-07-03-eh9-eh14.md) |
| `BUD-S31` | `EH10` | Prove restore | — | [09-restore-roundtrip.md](../spikes/09-restore-roundtrip.md) | [2026-07-03-eh10.md](../status-reports/2026-07-03-eh10.md) |
| `BUD-S32` | `EH11` | Bind localhost by default | — | — | [2026-07-02-eh11.md](../status-reports/2026-07-02-eh11.md) |
| `BUD-S33` | `EH12` | Share the DTO types; decide the client-boundary stance | — | — | [2026-07-03-eh12-eh13.md](../status-reports/2026-07-03-eh12-eh13.md) |
| `BUD-S34` | `EH13` | Lint the layer boundaries | — | — | [2026-07-03-eh12-eh13.md](../status-reports/2026-07-03-eh12-eh13.md) |
| `BUD-S35` | `EH14` | Make post-due idempotency structural | — | — | [2026-07-03-eh9-eh14.md](../status-reports/2026-07-03-eh9-eh14.md) |
| `BUD-S39` | `R1` | Account rename in UI | — | — | [2026-06-21-r1.md](../status-reports/2026-06-21-r1.md) |
| `BUD-S40` | `R2` | Needs-allocation count badge | — | — | [2026-06-22-r2.md](../status-reports/2026-06-22-r2.md) |
| `BUD-S41` | `R3` | Grouped navigation — unified Analysis section | — | — | [2026-06-22-r3.md](../status-reports/2026-06-22-r3.md) |
| `BUD-S42` | `R5` | Envelope targets visible inline | — | — | [2026-06-22-r5.md](../status-reports/2026-06-22-r5.md) |
| `BUD-S44` | `R11` | Route modularization | — | — | [2026-06-22-r11.md](../status-reports/2026-06-22-r11.md) |
| `BUD-S45` | `R12` | React error boundaries | — | — | [2026-06-23-r12.md](../status-reports/2026-06-23-r12.md) |
| `BUD-S46` | `R13` | Structured API logging | — | — | [2026-06-23-r13.md](../status-reports/2026-06-23-r13.md) |
| `BUD-S47` | `R14` | e2e expansion | — | — | [2026-06-17-r14.md](../status-reports/2026-06-17-r14.md) |
| `BUD-S48` | `UX4` | Design-system foundation | [design-system.md](../features/design-system.md) | — | [2026-06-26-ux4.md](../status-reports/2026-06-26-ux4.md) |
| `BUD-S49` | `UX3` | Routing + persistent app shell | [app-shell.md](../features/app-shell.md) | — | [2026-06-27-ux3.md](../status-reports/2026-06-27-ux3.md) |
| `BUD-S50` | `UX5` | Home: budget + future-planning cockpit | [cockpit.md](../features/cockpit.md) · [cockpit.md](../ux/cockpit.md) | — | [2026-06-27-ux5.md](../status-reports/2026-06-27-ux5.md) |
| `BUD-S51` | `UX6` | Demote management to a dedicated surface | [manage.md](../features/manage.md) · [manage.md](../ux/manage.md) | — | [2026-06-28-ux6.md](../status-reports/2026-06-28-ux6.md) |
| `BUD-S52` | `UX7` | Global quick-add transaction | [quick-add-transaction.md](../features/quick-add-transaction.md) · [quick-add-transaction.md](../ux/quick-add-transaction.md) | — | [2026-06-28-ux7.md](../status-reports/2026-06-28-ux7.md) |
| `BUD-S53` | `UX8` | rename + restyle the 6 views, replace number grids with accessible cha… | [insights-charts.md](../features/insights-charts.md) · [insights-charts.md](../ux/insights-charts.md) | — | [2026-06-28-ux8.md](../status-reports/2026-06-28-ux8.md) |
| `BUD-S54` | `UX9` | New viz: spending breakdown | [spending-breakdown.md](../features/spending-breakdown.md) · [spending-breakdown.md](../ux/spending-breakdown.md) | — | [2026-06-28-ux9.md](../status-reports/2026-06-28-ux9.md) |
| `BUD-S55` | `UX10` | New viz: spending trends over time | [spending-trends.md](../features/spending-trends.md) · [spending-trends.md](../ux/spending-trends.md) | — | [2026-07-01-ux10.md](../status-reports/2026-07-01-ux10.md) |
| `BUD-S56` | `UX11` | New viz: budget burn-down | [budget-burndown.md](../features/budget-burndown.md) · [budget-burndown.md](../ux/budget-burndown.md) | — | [2026-07-01-ux11.md](../status-reports/2026-07-01-ux11.md) |
| `BUD-S57` | `UX12` | Feedback & states | [destructive-confirms.md](../features/destructive-confirms.md) · [inline-validation.md](../features/inline-validation.md) · [skeleton-loaders.md](../features/skeleton-loaders.md) · [success-toasts.md](../features/success-toasts.md) | — | [2026-07-02-ux12.md](../status-reports/2026-07-02-ux12.md) · [2026-07-02-ux12b.md](../status-reports/2026-07-02-ux12b.md) · [2026-07-02-ux12c.md](../status-reports/2026-07-02-ux12c.md) · [2026-07-02-ux12d.md](../status-reports/2026-07-02-ux12d.md) |
| `BUD-S58` | `UX13` | Money & budget-health visual encoding | [budget-health-encoding.md](../features/budget-health-encoding.md) | — | [2026-07-02-ux13.md](../status-reports/2026-07-02-ux13.md) |
| `BUD-S59` | `UX14` | Empty states & first-run onboarding | [first-run-onboarding.md](../features/first-run-onboarding.md) | — | [2026-07-02-ux14.md](../status-reports/2026-07-02-ux14.md) |
| `BUD-S60` | `UX15` | Responsive pass | [responsive-pass.md](../features/responsive-pass.md) | — | [2026-07-02-ux15.md](../status-reports/2026-07-02-ux15.md) |
| `BUD-S61` | `S7` | Pay-period planning | [pay-periods.md](../features/pay-periods.md) · [pay-periods.md](../ux/pay-periods.md) | [10-payperiod-policy-validation.md](../spikes/10-payperiod-policy-validation.md) | [2026-07-03-s7-slice.md](../status-reports/2026-07-03-s7-slice.md) |
| `BUD-S62` | `S9` | "Still owed this month" | [pay-periods.md](../features/pay-periods.md) · [still-owed.md](../features/still-owed.md) · [pay-periods.md](../ux/pay-periods.md) | — | [2026-07-03-s9-s7-spec.md](../status-reports/2026-07-03-s9-s7-spec.md) |
| `BUD-S63` | `UXR1` | Sidebar app shell | [app-shell-sidebar.md](../features/app-shell-sidebar.md) · [app-shell-sidebar.md](../ux/app-shell-sidebar.md) | — | [2026-07-07-uxr1-sidebar-shell.md](../status-reports/2026-07-07-uxr1-sidebar-shell.md) |
| `BUD-S64` | `UXR2` | Pay-period planner | [pay-periods-planner.md](../features/pay-periods-planner.md) · [pay-periods-planner.md](../ux/pay-periods-planner.md) | — | [2026-07-07-uxr2-pay-period-planner.md](../status-reports/2026-07-07-uxr2-pay-period-planner.md) |
| `BUD-S65` | `UXR3` | Ledgers tables | [app-shell-sidebar.md](../features/app-shell-sidebar.md) · [demo-seed.md](../features/demo-seed.md) · [manage-move-money.md](../features/manage-move-money.md) · [pay-periods-planner.md](../features/pay-periods-planner.md) · [insights-ia.md](../ux/insights-ia.md) · [ledgers-tables.md](../ux/ledgers-tables.md) · [recurring-page.md](../ux/recurring-page.md) · [templates-page.md](../ux/templates-page.md) | — | [2026-07-07-uxr3-ledgers-tables.md](../status-reports/2026-07-07-uxr3-ledgers-tables.md) |
| `BUD-S66` | `UXR4` | Templates page | [templates-page.md](../ux/templates-page.md) | — | [2026-07-07-uxr4-templates-page.md](../status-reports/2026-07-07-uxr4-templates-page.md) |
| `BUD-S67` | `UXR5` | Recurring page | [recurring-page.md](../ux/recurring-page.md) | — | [2026-07-07-uxr5-recurring-page.md](../status-reports/2026-07-07-uxr5-recurring-page.md) |
| `BUD-S68` | `UXR6` | Insights IA | [insights-ia.md](../ux/insights-ia.md) | — | [2026-07-07-uxr6-insights-ia.md](../status-reports/2026-07-07-uxr6-insights-ia.md) |
| `BUD-S69` | `UXR7` | Manage page | [manage-move-money.md](../features/manage-move-money.md) | — | [2026-07-07-uxr7-manage-form.md](../status-reports/2026-07-07-uxr7-manage-form.md) |
| `BUD-S70` | `UXR8` | Demo-grade synthetic seed | [demo-seed.md](../features/demo-seed.md) | — | [2026-07-07-uxr8-demo-seed.md](../status-reports/2026-07-07-uxr8-demo-seed.md) |
| `BUD-S71` | `UXR9` | Dashboard IA | [dashboard-ia.md](../ux/dashboard-ia.md) | — | [2026-07-07-uxr9-dashboard-ia.md](../status-reports/2026-07-07-uxr9-dashboard-ia.md) |
| `BUD-S72` | `UXR10` | Insights chart X-axis readability | — | — | [2026-07-07-uxr10-chart-xaxis.md](../status-reports/2026-07-07-uxr10-chart-xaxis.md) |
| `BUD-S73` | `UXR11` | Add-transaction cleanup | — | — | [2026-07-08-uxr11-add-transaction.md](../status-reports/2026-07-08-uxr11-add-transaction.md) |
| `BUD-S74` | `UXR12` | Manage page formatting | — | — | [2026-07-08-uxr12-manage-formatting.md](../status-reports/2026-07-08-uxr12-manage-formatting.md) |
| `BUD-S75` | `UXR13` | Allocate form on the pattern | — | — | [2026-07-08-uxr13-allocate-form.md](../status-reports/2026-07-08-uxr13-allocate-form.md) |
| `BUD-S76` | `#15a` | Backup / export | — | — | [2026-06-17-slice-15a.md](../status-reports/2026-06-17-slice-15a.md) |
| `BUD-S78` | `#16` | a11y pass | — | — | [2026-06-21-16.md](../status-reports/2026-06-21-16.md) |
| `BUD-S79` | `#18` | Historical import | — | — | [2026-07-10-history-import.md](../status-reports/2026-07-10-history-import.md) |
| `BUD-S80` | `#20` | Statement import | — | [11-statement-extraction.md](../spikes/11-statement-extraction.md) | [2026-07-10-statement-import.md](../status-reports/2026-07-10-statement-import.md) |
| `SPIKE-01` | `#0` | Split-allocation UX | — | [01-split-allocation-ux.md](../spikes/01-split-allocation-ux.md) | — |
| `SPIKE-02` | `#2` | Technical feasibility / stack | — | [02-stack-feasibility.md](../spikes/02-stack-feasibility.md) | — |
| `SPIKE-03` | `#17` | SPIKE-03 — data-profiling: | — | [03-history-extraction.md](../spikes/03-history-extraction.md) | [2026-07-10-history-import.md](../status-reports/2026-07-10-history-import.md) |
| `SPIKE-04` | `#4` | Transfer modeling | — | [04-transfer-modeling.md](../spikes/04-transfer-modeling.md) | — |
| `SPIKE-05` | `#5` | Cash-flow forecast model | — | [05-cashflow-forecast.md](../spikes/05-cashflow-forecast.md) | — |
| `SPIKE-06` | `UX1` | Spike: design-system + routing foundation | — | [06-design-system-routing.md](../spikes/06-design-system-routing.md) | — |
| `SPIKE-07` | `UX2` | Spike: accessible charting / viz a11y | — | [07-accessible-charting.md](../spikes/07-accessible-charting.md) | [2026-06-28-ux2.md](../status-reports/2026-06-28-ux2.md) |
| `SPIKE-11` | `#21` | SPIKE-11 — data-profiling: | — | [11-statement-extraction.md](../spikes/11-statement-extraction.md) | [2026-07-10-spike-11-statement-profiling.md](../status-reports/2026-07-10-spike-11-statement-profiling.md) |

## 2. Reverse — each artifact → its roadmap id (and its declared status)

| Artifact | Status | → Roadmap id(s) |
| --- | --- | --- |
| [`features/accounts.md`](../features/accounts.md) | Implemented | `BUD-S1` (#1) |
| [`features/analysis-envelope-spend.md`](../features/analysis-envelope-spend.md) | Implemented | `BUD-S15` (#11) |
| [`features/app-shell-sidebar.md`](../features/app-shell-sidebar.md) | Implemented | `BUD-S63` (UXR1) · `BUD-S65` (UXR3) |
| [`features/app-shell.md`](../features/app-shell.md) | Implemented | `BUD-S49` (UX3) |
| [`features/archive-envelope.md`](../features/archive-envelope.md) | Implemented | `BUD-S5` (#6) |
| [`features/budget-burndown.md`](../features/budget-burndown.md) | Implemented | `BUD-S56` (UX11) |
| [`features/budget-health-encoding.md`](../features/budget-health-encoding.md) | Implemented | `BUD-S58` (UX13) |
| [`features/budget-vs-actual.md`](../features/budget-vs-actual.md) | Implemented | `BUD-S16` (#12) |
| [`features/cash-flow-forecast.md`](../features/cash-flow-forecast.md) | — | `BUD-S17` (#13) |
| [`features/cockpit.md`](../features/cockpit.md) | Implemented | `BUD-S50` (UX5) |
| [`features/credit-utilization.md`](../features/credit-utilization.md) | Implemented | `BUD-S18` (#14a) |
| [`features/debt-payoff.md`](../features/debt-payoff.md) | Implemented | `BUD-S19` (#14b) |
| [`features/demo-seed.md`](../features/demo-seed.md) | Implemented | `BUD-S65` (UXR3) · `BUD-S70` (UXR8) |
| [`features/design-system.md`](../features/design-system.md) | Implemented | `BUD-S48` (UX4) |
| [`features/destructive-confirms.md`](../features/destructive-confirms.md) | — | `BUD-S57` (UX12) |
| [`features/edit-split.md`](../features/edit-split.md) | Implemented | `BUD-S4` (#5) |
| [`features/envelope-ledger.md`](../features/envelope-ledger.md) | Implemented | `BUD-S14` (R15) |
| [`features/envelopes.md`](../features/envelopes.md) | Implemented | `BUD-S1` (#1) |
| [`features/first-run-onboarding.md`](../features/first-run-onboarding.md) | Implemented | `BUD-S59` (UX14) |
| [`features/inline-validation.md`](../features/inline-validation.md) | — | `BUD-S57` (UX12) |
| [`features/insights-charts.md`](../features/insights-charts.md) | Implemented | `BUD-S53` (UX8) |
| [`features/manage-move-money.md`](../features/manage-move-money.md) | Implemented | `BUD-S65` (UXR3) · `BUD-S69` (UXR7) |
| [`features/manage.md`](../features/manage.md) | Implemented | `BUD-S51` (UX6) |
| [`features/pay-periods-planner.md`](../features/pay-periods-planner.md) | Implemented | `BUD-S64` (UXR2) · `BUD-S65` (UXR3) |
| [`features/pay-periods.md`](../features/pay-periods.md) | — | `BUD-S61` (S7) · `BUD-S62` (S9) |
| [`features/quick-add-transaction.md`](../features/quick-add-transaction.md) | Implemented | `BUD-S52` (UX7) |
| [`features/reconcile.md`](../features/reconcile.md) | Implemented | `BUD-S10` (#10) |
| [`features/recurring.md`](../features/recurring.md) | Implemented | `BUD-S9` (#9) |
| [`features/refunds.md`](../features/refunds.md) | Implemented | `BUD-S8` (#8) |
| [`features/responsive-pass.md`](../features/responsive-pass.md) | Implemented | `BUD-S60` (UX15) |
| [`features/skeleton-loaders.md`](../features/skeleton-loaders.md) | — | `BUD-S57` (UX12) |
| [`features/spending-breakdown.md`](../features/spending-breakdown.md) | Implemented | `BUD-S54` (UX9) |
| [`features/spending-trends.md`](../features/spending-trends.md) | Implemented | `BUD-S55` (UX10) |
| [`features/still-owed.md`](../features/still-owed.md) | Implemented | `BUD-S62` (S9) |
| [`features/success-toasts.md`](../features/success-toasts.md) | — | `BUD-S57` (UX12) |
| [`features/templates.md`](../features/templates.md) | Implemented | `BUD-S3` (#4) |
| [`features/transactions.md`](../features/transactions.md) | Implemented | `BUD-S2` (#3) |
| [`features/transfers.md`](../features/transfers.md) | Implemented | `BUD-S6` (#7a) · `BUD-S7` (#7b) |
| [`spikes/01-split-allocation-ux.md`](../spikes/01-split-allocation-ux.md) | Done | `BUD-S3` (#4) · `SPIKE-01` (#0) |
| [`spikes/02-stack-feasibility.md`](../spikes/02-stack-feasibility.md) | Done | `SPIKE-02` (#2) |
| [`spikes/03-history-extraction.md`](../spikes/03-history-extraction.md) | Done | `SPIKE-03` (#17) |
| [`spikes/04-transfer-modeling.md`](../spikes/04-transfer-modeling.md) | Done | `BUD-S27` (EH6) · `SPIKE-04` (#4) |
| [`spikes/05-cashflow-forecast.md`](../spikes/05-cashflow-forecast.md) | Done | `BUD-S17` (#13) · `SPIKE-05` (#5) |
| [`spikes/06-design-system-routing.md`](../spikes/06-design-system-routing.md) | Done | `SPIKE-06` (UX1) |
| [`spikes/07-accessible-charting.md`](../spikes/07-accessible-charting.md) | Done | `SPIKE-07` (UX2) |
| [`spikes/08-budgethome-sheet-analysis.md`](../spikes/08-budgethome-sheet-analysis.md) | Done | `BUD-E9` (—) |
| [`spikes/09-restore-roundtrip.md`](../spikes/09-restore-roundtrip.md) | Done | `BUD-S31` (EH10) |
| [`spikes/10-payperiod-policy-validation.md`](../spikes/10-payperiod-policy-validation.md) | Done | `BUD-S61` (S7) |
| [`spikes/11-statement-extraction.md`](../spikes/11-statement-extraction.md) | Done | `BUD-S80` (#20) · `SPIKE-11` (#21) |
| [`status-reports/2026-06-13-foundation-slice.md`](../status-reports/2026-06-13-foundation-slice.md) | Snapshot | `BUD-S1` (#1) |
| [`status-reports/2026-06-13-slice-1.md`](../status-reports/2026-06-13-slice-1.md) | Snapshot | `BUD-S2` (#3) |
| [`status-reports/2026-06-13-slice-2.md`](../status-reports/2026-06-13-slice-2.md) | Snapshot | `BUD-S3` (#4) |
| [`status-reports/2026-06-13-slice-5.md`](../status-reports/2026-06-13-slice-5.md) | Snapshot | `BUD-S4` (#5) |
| [`status-reports/2026-06-13-slice-6.md`](../status-reports/2026-06-13-slice-6.md) | Snapshot | `BUD-S5` (#6) |
| [`status-reports/2026-06-14-slice-7a.md`](../status-reports/2026-06-14-slice-7a.md) | Snapshot | `BUD-S6` (#7a) |
| [`status-reports/2026-06-14-slice-7b.md`](../status-reports/2026-06-14-slice-7b.md) | Snapshot | `BUD-S7` (#7b) |
| [`status-reports/2026-06-14-slice-8.md`](../status-reports/2026-06-14-slice-8.md) | Snapshot | `BUD-S8` (#8) |
| [`status-reports/2026-06-14-slice-9.md`](../status-reports/2026-06-14-slice-9.md) | Snapshot | `BUD-S9` (#9) |
| [`status-reports/2026-06-15-eh1.md`](../status-reports/2026-06-15-eh1.md) | Snapshot | `BUD-S22` (EH1) |
| [`status-reports/2026-06-15-eh2.md`](../status-reports/2026-06-15-eh2.md) | Snapshot | `BUD-S23` (EH2) |
| [`status-reports/2026-06-15-eh3.md`](../status-reports/2026-06-15-eh3.md) | Snapshot | `BUD-S24` (EH3) |
| [`status-reports/2026-06-15-eh4.md`](../status-reports/2026-06-15-eh4.md) | Snapshot | `BUD-S25` (EH4) |
| [`status-reports/2026-06-15-eh5.md`](../status-reports/2026-06-15-eh5.md) | Snapshot | `BUD-S26` (EH5) |
| [`status-reports/2026-06-15-eh6.md`](../status-reports/2026-06-15-eh6.md) | Snapshot | `BUD-S27` (EH6) |
| [`status-reports/2026-06-15-slice-10.md`](../status-reports/2026-06-15-slice-10.md) | Snapshot | `BUD-S10` (#10) |
| [`status-reports/2026-06-15-slice-11.md`](../status-reports/2026-06-15-slice-11.md) | Snapshot | `BUD-S15` (#11) |
| [`status-reports/2026-06-16-slice-12.md`](../status-reports/2026-06-16-slice-12.md) | Snapshot | `BUD-S16` (#12) |
| [`status-reports/2026-06-16-slice-13.md`](../status-reports/2026-06-16-slice-13.md) | Snapshot | `BUD-S17` (#13) |
| [`status-reports/2026-06-16-slice-14a.md`](../status-reports/2026-06-16-slice-14a.md) | Snapshot | `BUD-S18` (#14a) |
| [`status-reports/2026-06-16-slice-14b.md`](../status-reports/2026-06-16-slice-14b.md) | Snapshot | `BUD-S19` (#14b) |
| [`status-reports/2026-06-17-r14.md`](../status-reports/2026-06-17-r14.md) | Snapshot | `BUD-S47` (R14) |
| [`status-reports/2026-06-17-slice-15a.md`](../status-reports/2026-06-17-slice-15a.md) | Snapshot | `BUD-S76` (#15a) |
| [`status-reports/2026-06-21-16.md`](../status-reports/2026-06-21-16.md) | Snapshot | `BUD-S78` (#16) |
| [`status-reports/2026-06-21-r1.md`](../status-reports/2026-06-21-r1.md) | Snapshot | `BUD-S39` (R1) |
| [`status-reports/2026-06-21-r15.md`](../status-reports/2026-06-21-r15.md) | Snapshot | `BUD-S14` (R15) |
| [`status-reports/2026-06-21-r6.md`](../status-reports/2026-06-21-r6.md) | Snapshot | `BUD-S11` (R6) |
| [`status-reports/2026-06-21-r7.md`](../status-reports/2026-06-21-r7.md) | Snapshot | `BUD-S12` (R7) |
| [`status-reports/2026-06-22-r11.md`](../status-reports/2026-06-22-r11.md) | Snapshot | `BUD-S44` (R11) |
| [`status-reports/2026-06-22-r2.md`](../status-reports/2026-06-22-r2.md) | Snapshot | `BUD-S40` (R2) |
| [`status-reports/2026-06-22-r3.md`](../status-reports/2026-06-22-r3.md) | Snapshot | `BUD-S41` (R3) |
| [`status-reports/2026-06-22-r4.md`](../status-reports/2026-06-22-r4.md) | Snapshot | `BUD-S21` (R4) |
| [`status-reports/2026-06-22-r5.md`](../status-reports/2026-06-22-r5.md) | Snapshot | `BUD-S42` (R5) |
| [`status-reports/2026-06-22-r8.md`](../status-reports/2026-06-22-r8.md) | Snapshot | `BUD-S13` (R8) |
| [`status-reports/2026-06-22-r9.md`](../status-reports/2026-06-22-r9.md) | Snapshot | `BUD-S20` (R9) |
| [`status-reports/2026-06-23-r12.md`](../status-reports/2026-06-23-r12.md) | Snapshot | `BUD-S45` (R12) |
| [`status-reports/2026-06-23-r13.md`](../status-reports/2026-06-23-r13.md) | Snapshot | `BUD-S46` (R13) |
| [`status-reports/2026-06-26-ux4.md`](../status-reports/2026-06-26-ux4.md) | Snapshot | `BUD-S48` (UX4) |
| [`status-reports/2026-06-27-ux3.md`](../status-reports/2026-06-27-ux3.md) | Snapshot | `BUD-S49` (UX3) |
| [`status-reports/2026-06-27-ux5.md`](../status-reports/2026-06-27-ux5.md) | Snapshot | `BUD-S50` (UX5) |
| [`status-reports/2026-06-28-ux2.md`](../status-reports/2026-06-28-ux2.md) | Snapshot | `SPIKE-07` (UX2) |
| [`status-reports/2026-06-28-ux6.md`](../status-reports/2026-06-28-ux6.md) | Snapshot | `BUD-S51` (UX6) |
| [`status-reports/2026-06-28-ux7.md`](../status-reports/2026-06-28-ux7.md) | Snapshot | `BUD-S52` (UX7) |
| [`status-reports/2026-06-28-ux8.md`](../status-reports/2026-06-28-ux8.md) | Snapshot | `BUD-S53` (UX8) |
| [`status-reports/2026-06-28-ux9.md`](../status-reports/2026-06-28-ux9.md) | Snapshot | `BUD-S54` (UX9) |
| [`status-reports/2026-07-01-ux10.md`](../status-reports/2026-07-01-ux10.md) | Snapshot | `BUD-S55` (UX10) |
| [`status-reports/2026-07-01-ux11.md`](../status-reports/2026-07-01-ux11.md) | Snapshot | `BUD-S56` (UX11) |
| [`status-reports/2026-07-02-eh11.md`](../status-reports/2026-07-02-eh11.md) | Snapshot | `BUD-S32` (EH11) |
| [`status-reports/2026-07-02-eh7.md`](../status-reports/2026-07-02-eh7.md) | Snapshot | `BUD-S28` (EH7) |
| [`status-reports/2026-07-02-ux12.md`](../status-reports/2026-07-02-ux12.md) | Snapshot | `BUD-S57` (UX12) |
| [`status-reports/2026-07-02-ux12b.md`](../status-reports/2026-07-02-ux12b.md) | Snapshot | `BUD-S57` (UX12) |
| [`status-reports/2026-07-02-ux12c.md`](../status-reports/2026-07-02-ux12c.md) | Snapshot | `BUD-S57` (UX12) |
| [`status-reports/2026-07-02-ux12d.md`](../status-reports/2026-07-02-ux12d.md) | Snapshot | `BUD-S57` (UX12) |
| [`status-reports/2026-07-02-ux13.md`](../status-reports/2026-07-02-ux13.md) | Snapshot | `BUD-S58` (UX13) |
| [`status-reports/2026-07-02-ux14.md`](../status-reports/2026-07-02-ux14.md) | Snapshot | `BUD-S59` (UX14) |
| [`status-reports/2026-07-02-ux15.md`](../status-reports/2026-07-02-ux15.md) | Snapshot | `BUD-S60` (UX15) |
| [`status-reports/2026-07-03-eh10.md`](../status-reports/2026-07-03-eh10.md) | Snapshot | `BUD-S31` (EH10) |
| [`status-reports/2026-07-03-eh12-eh13.md`](../status-reports/2026-07-03-eh12-eh13.md) | Snapshot | `BUD-S33` (EH12) · `BUD-S34` (EH13) |
| [`status-reports/2026-07-03-eh8.md`](../status-reports/2026-07-03-eh8.md) | Snapshot | `BUD-S29` (EH8) |
| [`status-reports/2026-07-03-eh9-eh14.md`](../status-reports/2026-07-03-eh9-eh14.md) | Snapshot | `BUD-S30` (EH9) · `BUD-S35` (EH14) |
| [`status-reports/2026-07-03-s7-slice.md`](../status-reports/2026-07-03-s7-slice.md) | Snapshot | `BUD-S61` (S7) |
| [`status-reports/2026-07-03-s9-s7-spec.md`](../status-reports/2026-07-03-s9-s7-spec.md) | Snapshot | `BUD-S62` (S9) |
| [`status-reports/2026-07-07-uxr-scoping.md`](../status-reports/2026-07-07-uxr-scoping.md) | Snapshot | `BUD-E10` (—) |
| [`status-reports/2026-07-07-uxr1-sidebar-shell.md`](../status-reports/2026-07-07-uxr1-sidebar-shell.md) | Snapshot | `BUD-S63` (UXR1) |
| [`status-reports/2026-07-07-uxr10-chart-xaxis.md`](../status-reports/2026-07-07-uxr10-chart-xaxis.md) | — | `BUD-S72` (UXR10) |
| [`status-reports/2026-07-07-uxr2-pay-period-planner.md`](../status-reports/2026-07-07-uxr2-pay-period-planner.md) | Snapshot | `BUD-S64` (UXR2) |
| [`status-reports/2026-07-07-uxr3-ledgers-tables.md`](../status-reports/2026-07-07-uxr3-ledgers-tables.md) | Snapshot | `BUD-S65` (UXR3) |
| [`status-reports/2026-07-07-uxr4-templates-page.md`](../status-reports/2026-07-07-uxr4-templates-page.md) | Snapshot | `BUD-S66` (UXR4) |
| [`status-reports/2026-07-07-uxr5-recurring-page.md`](../status-reports/2026-07-07-uxr5-recurring-page.md) | Snapshot | `BUD-S67` (UXR5) |
| [`status-reports/2026-07-07-uxr6-insights-ia.md`](../status-reports/2026-07-07-uxr6-insights-ia.md) | Snapshot | `BUD-S68` (UXR6) |
| [`status-reports/2026-07-07-uxr7-manage-form.md`](../status-reports/2026-07-07-uxr7-manage-form.md) | — | `BUD-S69` (UXR7) |
| [`status-reports/2026-07-07-uxr8-demo-seed.md`](../status-reports/2026-07-07-uxr8-demo-seed.md) | Snapshot | `BUD-S70` (UXR8) |
| [`status-reports/2026-07-07-uxr9-dashboard-ia.md`](../status-reports/2026-07-07-uxr9-dashboard-ia.md) | — | `BUD-S71` (UXR9) |
| [`status-reports/2026-07-08-uxr11-add-transaction.md`](../status-reports/2026-07-08-uxr11-add-transaction.md) | — | `BUD-S73` (UXR11) |
| [`status-reports/2026-07-08-uxr12-manage-formatting.md`](../status-reports/2026-07-08-uxr12-manage-formatting.md) | — | `BUD-S74` (UXR12) |
| [`status-reports/2026-07-08-uxr13-allocate-form.md`](../status-reports/2026-07-08-uxr13-allocate-form.md) | — | `BUD-S75` (UXR13) |
| [`status-reports/2026-07-10-history-import.md`](../status-reports/2026-07-10-history-import.md) | — | `BUD-S79` (#18) · `SPIKE-03` (#17) |
| [`status-reports/2026-07-10-spike-11-statement-profiling.md`](../status-reports/2026-07-10-spike-11-statement-profiling.md) | — | `SPIKE-11` (#21) |
| [`status-reports/2026-07-10-statement-import.md`](../status-reports/2026-07-10-statement-import.md) | — | `BUD-S80` (#20) |
| [`ux/analysis-envelope-spend.md`](../ux/analysis-envelope-spend.md) | Accepted | `BUD-S15` (#11) |
| [`ux/app-shell-sidebar.md`](../ux/app-shell-sidebar.md) | Proposed | `BUD-S63` (UXR1) |
| [`ux/archive-envelope.md`](../ux/archive-envelope.md) | Accepted | `BUD-S5` (#6) |
| [`ux/budget-burndown.md`](../ux/budget-burndown.md) | Accepted | `BUD-S56` (UX11) |
| [`ux/budget-vs-actual.md`](../ux/budget-vs-actual.md) | Accepted | `BUD-S16` (#12) |
| [`ux/cash-flow-forecast.md`](../ux/cash-flow-forecast.md) | Accepted | `BUD-S17` (#13) |
| [`ux/cockpit.md`](../ux/cockpit.md) | Accepted | `BUD-S50` (UX5) |
| [`ux/credit-utilization.md`](../ux/credit-utilization.md) | Accepted | `BUD-S18` (#14a) |
| [`ux/dashboard-ia.md`](../ux/dashboard-ia.md) | — | `BUD-S71` (UXR9) |
| [`ux/debt-payoff.md`](../ux/debt-payoff.md) | Accepted | `BUD-S19` (#14b) |
| [`ux/edit-split.md`](../ux/edit-split.md) | Accepted | `BUD-S4` (#5) |
| [`ux/envelope-ledger.md`](../ux/envelope-ledger.md) | Implemented | `BUD-S14` (R15) |
| [`ux/foundation.md`](../ux/foundation.md) | Accepted | `BUD-S1` (#1) |
| [`ux/insights-charts.md`](../ux/insights-charts.md) | Accepted | `BUD-S53` (UX8) |
| [`ux/insights-ia.md`](../ux/insights-ia.md) | Implemented | `BUD-S65` (UXR3) · `BUD-S68` (UXR6) |
| [`ux/ledgers-tables.md`](../ux/ledgers-tables.md) | Implemented | `BUD-S65` (UXR3) |
| [`ux/manage.md`](../ux/manage.md) | Accepted | `BUD-S51` (UX6) |
| [`ux/pay-periods-planner.md`](../ux/pay-periods-planner.md) | Implemented | `BUD-S64` (UXR2) |
| [`ux/pay-periods.md`](../ux/pay-periods.md) | — | `BUD-S61` (S7) · `BUD-S62` (S9) |
| [`ux/quick-add-transaction.md`](../ux/quick-add-transaction.md) | Accepted | `BUD-S52` (UX7) |
| [`ux/reconcile.md`](../ux/reconcile.md) | Accepted | `BUD-S10` (#10) |
| [`ux/recurring-page.md`](../ux/recurring-page.md) | Implemented | `BUD-S65` (UXR3) · `BUD-S67` (UXR5) |
| [`ux/recurring.md`](../ux/recurring.md) | Accepted | `BUD-S9` (#9) |
| [`ux/refunds.md`](../ux/refunds.md) | Accepted | `BUD-S8` (#8) |
| [`ux/spending-breakdown.md`](../ux/spending-breakdown.md) | Accepted | `BUD-S54` (UX9) |
| [`ux/spending-trends.md`](../ux/spending-trends.md) | Accepted | `BUD-S55` (UX10) |
| [`ux/templates-page.md`](../ux/templates-page.md) | Implemented | `BUD-S65` (UXR3) · `BUD-S66` (UXR4) |
| [`ux/templates.md`](../ux/templates.md) | Accepted | `BUD-S3` (#4) |
| [`ux/transactions.md`](../ux/transactions.md) | Accepted | `BUD-S2` (#3) |
| [`ux/transfers.md`](../ux/transfers.md) | Accepted | `BUD-S6` (#7a) · `BUD-S7` (#7b) |

## 3. Coverage

- **158** of **158** artifact files carry a `roadmap-item` in their frontmatter
  and appear above — **self-describing**, no supplement, no roadmap-link dependency.
- **0** with a frontmatter problem (see `npm run docs:check`).
