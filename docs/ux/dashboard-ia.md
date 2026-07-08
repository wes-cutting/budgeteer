<!--
UX SPEC — UXR9 (2026-07-07 UX Redesign, post-track polish): the Dashboard information architecture —
the home (`/`) and the pay-period planner (`/pay-periods`) become two sub-tabs of one Dashboard
(Overview + Pay periods), the sidebar "Home" is renamed "Dashboard", the standalone Pay periods
sidebar destination is absorbed, the planner earns more width, and the site-wide sub-tab navs
(Dashboard + Insights) are centered. Owner-directed (post-Redesign polish batch). §11 compression —
presentation/IA only, build detail here.
-->

# UX Spec — Dashboard IA (Overview + Pay periods sub-tabs)

| Field        | Value                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Status       | Implemented — built 2026-07-07 (§8 as built); owner-directed polish batch                                              |
| Feature      | UXR9 (IA/presentation; §11 compression — build detail here)                                                            |
| Owner        | Wesley Cutting                                                                                                          |
| Last updated | 2026-07-07                                                                                                              |
| Related      | [UXR1 shell](app-shell-sidebar.md) (heading rule, nav groups) · [UXR2 pay-periods-planner](pay-periods-planner.md) (the planner, now a sub-tab) · [UXR6 insights-ia](insights-ia.md) (the sub-tab-nav treatment, now centered + shared) · [cockpit](cockpit.md) (Overview) |
| Gated by     | UXR1 (shell owns `<h1>`) · UXR2 (the pay-period planner exists to absorb)                                              |

## 1. User & job

Living with the redesigned app surfaced that "Home" reads as a generic landing page, and the
pay-period planner — the household's cash-flow answer — sat off in the Planning group where it was
easy to miss. The owner wants the home reframed as a **Dashboard** with the planner promoted onto it,
and the two big planner ledgers given room to breathe.

## 2. The IA

| Dashboard sub-tab | URL             | Content                                                        |
| ----------------- | --------------- | ------------------------------------------------------------- |
| **Overview**      | `/`             | The UX5 cockpit (five panels) — unchanged.                    |
| **Pay periods**   | `/pay-periods`  | The FEAT-UXR2 planner — Bills + Paychecks side-by-side ledgers, unchanged behaviour; the payday→bills highlight is preserved (owner chose to keep the two panes together rather than split them). |

- **"Home" → "Dashboard"** in the sidebar (Budget group). `end` keeps the sidebar item active only
  on `/`; the Pay periods sub-tab surfaces in the Dashboard's own sub-tab nav, not the sidebar.
- **Pay periods leaves the sidebar Planning group** (absorbed into the Dashboard). Its URL
  `/pay-periods` is **preserved** — deep links, the cockpit's Next-paycheck link, and the
  `/insights/pay-periods` redirect are all unchanged.
- **Both sub-tabs keep the shell `<h1>` "Dashboard"** (UXR1 rule); each sub-view renders its own
  `<h2>`s below (Overview's `Overview`; the planner's `Bills`/`Paychecks`).

## 3. Structure & navigation

- A pathless **`DashboardLayout`** route wraps the index (Overview) and the `pay-periods` child,
  rendering a centered `<nav aria-label="Dashboard views">` of two `NavLink`s (Overview `to="/"`
  `end`, Pay periods `to="/pay-periods"` `end`) above the active sub-view.
- Deliberately **links, not ARIA tabs** — these are routes (back/forward, deep links, refresh must
  keep working; the ADR-0006/UX3 stance, matching Insights).
- The sub-tab nav reuses the Insights **`.categoryNav`** treatment from `Insights.module.css` (which
  `PayPeriodsView` already shares), now **centered** — the same centering applied to the Insights
  category + segment rows (owner's "center the site-wide sub-tab navs").

## 4. States

No data states of its own (the nav is static; each sub-view keeps its own loading/empty/error). The
planner sub-tab renders in a **wider `main`** (1200px vs the global 960px reading measure) so the two
ledgers get more room; at narrow width the panes stack and each table scrolls in its own region, so
the wider cap is inert there.

## 5. Accessibility

Labeled nav landmark (`Dashboard views`) distinct from the sidebar (`Primary`); active state =
weight + underline edge + `aria-current="page"` (NavLink); keyboard order = visual order; the shell
keeps exactly one `<h1>`; axe light AND dark on the Dashboard; 320px reflow (the planner panes stack,
no page scroll).

## 6. Acceptance criteria (UX)

- **Given** `/`, **then** the sidebar shows "Dashboard" (not "Home"), the Dashboard sub-tab nav shows
  Overview active, and the shell `<h1>` reads "Dashboard".
- **Given** the Pay periods sub-tab, **then** `/pay-periods` renders the two-ledger planner with the
  sub-tab nav marking Pay periods active; the sidebar has no "Pay periods" item.
- **Given** any old `/pay-periods` deep link or the `/insights/pay-periods` redirect, **then** it
  lands on the Dashboard's Pay periods sub-tab — zero broken links.
- The cockpit's Next-paycheck link still targets `/pay-periods`.
- Both site-wide sub-tab navs (Dashboard + Insights) are centered; the planner reads wider.
- Axe light+dark; 320px reflow per §5.

## 7. Out of scope

Cockpit panel content · planner math/behaviour (byte-for-byte) · the pay-period per-account model
(one plan per selected account — a known FEAT-S7 characteristic, unchanged) · splitting Bills and
Paychecks onto separate tabs (owner chose to keep them together to preserve the highlight join).

## 8. As built (2026-07-07)

- **New `DashboardLayout`** ([`DashboardLayout.tsx`](../../apps/web/src/DashboardLayout.tsx)) — a
  pathless layout route in [`routes.tsx`](../../apps/web/src/routes.tsx) wrapping `{ index: Overview }`
  + `{ path: "pay-periods" }`, both carrying `handle: { title: "Dashboard" }`. Renders the centered
  sub-tab nav + `<Outlet/>`.
- **Sidebar** ([`AppShell.tsx`](../../apps/web/src/AppShell.tsx)) — Budget group item "Home" → "Dashboard"
  (`to="/"` `end`, HomeIcon kept); the Planning group's "Pay periods" item removed (the
  `PayPeriodsIcon` import dropped). The standalone `/pay-periods` route is gone from `routes.tsx`; its
  path lives on as the sub-tab's URL, and `/insights/pay-periods` still redirects to it.
- **Width** — `PayPeriodsView`'s `<main>` gains `styles.widePlanner` (`max-width: 1200px`, overriding
  the global `main` element rule by class specificity).
- **Centering** ([`Insights.module.css`](../../apps/web/src/Insights.module.css)) — `.categoryNav` and
  `.segmentNav` get `justify-content: center`; `.categoryNav` active now also matches
  `a[aria-current="page"]` so the Dashboard NavLinks light correctly (Insights' `<Link>` +
  `.categoryActive` path unchanged).
- **Behaviour byte-for-byte:** the cockpit (Overview) and the planner (Pay periods) are untouched —
  no data/API/domain change.
- **Gate:** unit `AppShell.test` re-pointed ("Home" → "Dashboard"; no "Pay periods" sidebar link);
  e2e `setup.goToDashboard` + a new `dashboardViews` helper re-point the nav (Pay periods reached via
  the Dashboard sub-tab); the `"Home"` `level:1` heading assertions across specs → `"Dashboard"`;
  `analysis.spec` pay-periods active-state assertions moved to the Dashboard sub-tab nav; axe
  light+dark + 320px reflow carry.
