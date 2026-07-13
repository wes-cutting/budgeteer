---
type: ux-spec
roadmap-item: [BUD-S61, BUD-S62]
---
<!--
UX SPEC — S7 pay-period planning. Pairs with FEAT-S7 (docs/features/pay-periods.md). The sheet's
colour-only blue/red bucket join (SPIKE-08 §5) is deliberately NOT replicated — the join is carried
by structure (bills grouped inside their paycheck's section) + explicit text, per ADR-0007/UX13.
-->

# UX Spec — Insights: pay periods ("which paycheck covers what")

> **Redesign proposed (2026-07-06):** [UXR2 — Pay-period planner](pay-periods-planner.md)
> (`Draft`) supersedes this spec's **§3 presentation** (stacked bucket sections → side-by-side
> ledgers at a first-class `/pay-periods`) when it ships. The states, copy, badges, policy, and
> a11y stance here carry forward; this spec describes the shipped surface until then.

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Status       | **Validated** (FEAT-S7 §9 ran 2026-07-03 — SPIKE-10; view structure unchanged, over-committed badge added) |
| Feature      | FEAT-S7 ([feature spec](../features/pay-periods.md)) |
| Owner        | Wesley Cutting                                     |
| Last updated | 2026-07-03                                         |

## 1. User & job

Payday arrives; bills cluster at month boundaries. The user opens this view to answer: **"what
must this check cover, and does the whole plan still hold?"** — the sheet's core methodology
(every check pre-committed ~a month ahead, headroom proving viability) without the hand-run
J/K/H columns.

## 2. Entry point & navigation

A new **Pay periods** tab in the Insights sub-nav (`/insights/pay-periods`), beside Forecast —
it is the forecast's planning twin (same inputs, commitment-time lens instead of due-date lens).
Heading: **"Insights — pay periods"**.

## 3. Screen structure (populated)

Controls: the **account picker only** (same one-account convention as Forecast; `leadDays` and
the horizon are fixed in V1). Below it, the plan as a date-ordered sequence of **bucket
sections**, each an `<h3>`-titled group so the join is structural:

1. **Bucket zero — "From current balance"** (only when non-empty): bills due too soon for any
   future check, with the same table shape as paycheck buckets.
2. **One section per expected paycheck:**
   - Heading: `<payee/label> · <date> · +$X` (e.g. "Employer Direct Deposit · 2026-07-17 ·
     +$3,200.00").
   - A one-line coverage sentence — the sheet's L-column month label, as text: e.g. *"Covers 4
     bills due 2026-08-01 – 2026-08-12."*
   - A table of covered bills: label · due date · amount (date-sorted; `.table-scroll` reflow
     wrapper per UX15).
   - A **Planned spending** row (the netted per-period share; omitted when $0).
   - Footer figures (`<dl>`): **Bucket total** and **Headroom after this check** — headroom
     carries a text badge: **Covered** or **Plan breaks here** (first negative bucket), with the
     signed money value as the non-colour signal; subsequent negative buckets read **Short**.
   - When the bucket's total exceeds its check (the FEAT-S7 §5 overflow fallback), the heading
     row carries an **Over-committed** text badge — the fallback is never silent.

Money is plain labelled text; direction carried by sign and words. Nothing in the view encodes
meaning by colour alone (WCAG 1.4.1); badges are the existing text `Badge` primitive.

## 4. States

- **Loading** — `Skeleton` (polite "Loading…").
- **Error** — inline `role="alert"` failure note (the Insights convention), view chrome intact.
- **Empty (no income rule)** — `EmptyState`: "No expected paychecks — add a recurring **deposit**
  rule (e.g. your paycheck) to plan pay periods", linking to `/recurring`.
- **Empty (no bills)** — paycheck sections render with "No bills assigned" + planned spending
  only; the plan is still meaningful (all headroom).
- **Populated** — §3.

## 5. Accessibility

- Axe-clean (WCAG 2.2 AA) **light and dark**, including at 320px reflow (UX15); tables scroll in
  their own keyboard-focusable region, never the page.
- Structure is the join: one `<h2>` view heading, one `<h3>` per bucket, tables with proper
  headers, figures as `<dl>` — a screen reader hears "which check covers what" in the same
  order a sighted user reads it. No information lives only in layout or colour.
- No animation; the shell owns reduced-motion route transitions.

## 6. Out of scope (V1)

Drag/move a bill between checks (FEAT-S7 §8 assignment store), `leadDays`/horizon controls,
multi-account plans, a chart shape (the buckets are tabular; a headroom sparkline is a possible
follow-on reusing `LineChart`).
