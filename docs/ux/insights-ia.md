---
type: ux-spec
roadmap-item: [BUD-S65, BUD-S68]
status: Implemented
---
<!--
UX SPEC — UXR6 (2026-07-06 UX Redesign): the Insights information architecture — the wrapping
ten-link sub-nav becomes a five-category top tab bar with segmented sub-views. Direction
owner-endorsed 2026-07-07. Every /insights/:view URL is preserved. Initiative brief:
reviews/2026-07-06-ux-redesign-initiative.md.
-->

# UX Spec — Insights IA (category tabs)

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Status       | Implemented — built 2026-07-07 (§8 as built); direction owner-endorsed 2026-07-06/07 |
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

## 8. As built (2026-07-07)

Built presentation-only in [`AnalysisSection.tsx`](../../apps/web/src/AnalysisSection.tsx) —
no data/API/view change. A `CATEGORIES` map (the §2 table) drives two rows:

- **Primary** `<nav aria-label="Insights categories">` — five plain `<Link>`s, each `to` its
  category's default sub-view (`views[0]`). Active = the category **containing** the current
  `:view`, marked with `aria-current="page"` + weight + a bottom-edge bar (never colour
  alone). Because a category represents a *section*, its link carries `aria-current` while on
  any of its views even though the `href` points at the default — so it is a `<Link>` with a
  computed `aria-current`, **not** a `NavLink` (whose match is exact-URL). **Design call, per
  the §3 "links, not ARIA tabs" stance.**
- **Secondary** `<nav aria-label="{Category} views">` — the active category's sub-views as
  `NavLink`s with `end`; rendered **only when the category has > 1 view** (Cash flow · Net
  worth get no row). One-to-one with a URL, so `NavLink`'s exact match is exactly right.
- **Renames are nav-label-only:** `spend` shows as **By envelope**, `budget` as **vs Actual**.
  Routes and each view's own `<h2>` ("Insights — …") are **untouched**, so the a11y/cockpit
  `level: 2` heading assertions and every cockpit `/insights/*` href are unaffected.
- **URL preservation, tested:** the `/insights` index redirect, the unknown-view → `spend`
  fallback, and `/insights/pay-periods` → `/pay-periods` all carry unchanged; a new
  `routing.spec` sweep deep-links all nine `/insights/:view` URLs and asserts the correct
  category tab is current. The `ErrorBoundary` (R12) and `renderView` switch are byte-for-byte.
- **CSS:** the UX15 `.subnav` is superseded by `.categoryNav` + `.segmentNav`
  ([`Insights.module.css`](../../apps/web/src/Insights.module.css)) — both wrap with ≥ 24px
  targets so the two-row bar never forces horizontal page scroll at 320px.
- **Gate:** unit `AnalysisSection.test` rewritten (five category tabs, segment-row-only-when->1,
  renamed labels, category active on a non-default sub-view); e2e `openAnalysis` walks
  category → segment (a label→category map; the two renamed call-site labels re-pointed); axe
  light AND dark + 320px reflow over the new chrome all green.
