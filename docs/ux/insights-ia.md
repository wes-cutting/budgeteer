<!--
UX SPEC — UXR6 (2026-07-06 UX Redesign): the Insights information architecture — the wrapping
ten-link sub-nav becomes a five-category top tab bar with segmented sub-views. Direction
owner-endorsed 2026-07-07. Every /insights/:view URL is preserved. Initiative brief:
reviews/2026-07-06-ux-redesign-initiative.md.
-->

# UX Spec — Insights IA (category tabs)

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Status       | Proposed — direction owner-endorsed 2026-07-06/07                        |
| Feature      | UXR6 (IA/presentation; §11 compression — build detail here)              |
| Owner        | Wesley Cutting                                                           |
| Last updated | 2026-07-07                                                               |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · [FEAT-UX8 insights-charts](../features/insights-charts.md) (views, unchanged) · [UXR1 shell](app-shell-sidebar.md) (heading rule) |
| Gated by     | UXR1 · UXR2 (Pay periods leaves Insights → the tab set is final)         |

## 1. User & job

Nine analysis views (ten until UXR2 moves Pay periods out) behind one flat wrapping link row.
The user wants to answer a *category* of question — "where's my money going?", "am I on
budget?" — not pick from ten peers. The owner endorsed grouping into five category tabs.

## 2. The IA

| Category tab | Sub-views (existing routes, labels shown) | Default |
| ------------ | ----------------------------------------- | ------- |
| **Spending** | By envelope (`spend`) · Breakdown (`breakdown`) · Trends (`trends`) | By envelope |
| **Budget** | vs Actual (`budget`) · Burn-down (`burndown`) | vs Actual |
| **Cash flow** | Forecast (`forecast`) | — (single) |
| **Debt** | Credit (`credit`) · Payoff (`payoff`) | Credit |
| **Net worth** | Net worth (`networth`) | — (single) |

- **Every `/insights/:view` URL is preserved** — the active category *and* segment derive
  from the URL; nothing breaks, nothing redirects except the carried defaults
  (`/insights` → `/insights/spend`; unknown view → `spend`).
- Two view labels change (`Spend` → **By envelope**, `Budget` → **vs Actual**) so they read
  under their category; routes untouched. **Owner-ratified 2026-07-07.**
- `Pay periods` is gone from this nav (UXR2's `/pay-periods`; its old URL redirects there).

## 3. Structure & navigation

- **Primary row:** five category links — a `<nav aria-label="Insights categories">` of
  `NavLink`s (a category link targets its default sub-view; active = path within the
  category, marked weight + underline/edge + `aria-current`).
- **Secondary row:** the active category's sub-views as a segmented control of `NavLink`s
  (`aria-label="<Category> views"`), rendered **only when the category has > 1 view**.
- Deliberately **links, not ARIA tabs**: these are routes — back/forward, deep links, and
  refresh must keep working (the ADR-0006/UX3 stance; the current sub-nav is already
  NavLink-based for the same reason).
- The shell owns the `<h1>` ("Insights", UXR1); the active view's heading is an `<h2>`
  (unchanged from the UXR1 migration). Per-view `ErrorBoundary` carries.

## 4. States

No data states of its own (the nav is static; each view keeps its own loading/empty/error).
Narrow width: both rows wrap with ≥ 24px targets (the UX15 sub-nav treatment, now two short
rows instead of one long one).

## 5. Accessibility

Two labeled nav landmarks with distinct names; active state = weight + non-color marker +
`aria-current="page"`; keyboard order = visual order; axe light AND dark across every view
under the new nav; 320px reflow.

## 6. Acceptance criteria (UX)

- **Given** any old `/insights/:view` URL, **then** it renders the same view with the correct
  category + segment active — zero broken links (e2e sweeps all nine).
- **Given** a category with one view, **then** no segment row renders.
- `/insights` and unknown views land on `spend` (carried); back/forward walk the history
  through tabs and segments.
- Renamed labels (**By envelope**, **vs Actual**) appear; every view's content and its data
  table fallback unchanged.
- Axe light+dark; 320px targets/wrap per §4.

## 7. Out of scope

View content/chart changes · new views · the UXR8 seed (separate item; this IA is honest at
any data volume) · URL renames (deliberately none).
