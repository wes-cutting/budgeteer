<!--
FEATURE SPEC — scopes roadmap item UX15 (2026-06-25 UX Uplift, Phase 4 "Polish"): the responsive
pass. Fast-path ceremony (docs/00_WAYS_OF_WORKING.md §11): this note IS the spec — a small,
CSS/token-only presentation slice on the existing UX3 shell + UX4/UX8 modules. No ADR / no spike / no
new dependency. No data / API / domain change.
-->

# Feature Spec — Responsive pass (UX15)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX15                                                            |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux15.md))   |
| Owner        | Wesley Cutting                                                        |
| Last updated | 2026-07-02                                                           |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX15`, §5 Phase 4 — the **last** item) · builds on the [app shell](app-shell.md) (UX3), [design system](design-system.md) (UX4), and the [Insights charts](insights-charts.md) (UX8) · honours [ADR-0007](../adr/ADR-0007-accessible-charting.md) (charts already scale) |

## 1. Summary

The uplift is **desktop-first** ([initiative §1](../reviews/2026-06-25-ux-uplift-initiative.md)):
optimize for a desk, "stay responsive enough not to break on a phone." Much of that already held —
the [cockpit](cockpit.md) grid and the Insights figure lists are `auto-fit minmax(...)` (they
**already stack**), the shell nav and the account-register rows already `flex-wrap`, and the chart
SVGs are `width:100%` (they **already scale**). This slice closes the remaining phone-width gaps so
the app degrades **gracefully** to ~320px:

- **Wide data tables no longer overflow the page** (WCAG 1.4.10 reflow) — they scroll within their
  own **keyboard-focusable** region instead.
- **The shell header degrades to a narrow column** (brand stacked over the wrapping nav, comfortable
  tap targets), and the **Insights sub-nav** becomes a real wrapping tab row with valid tap targets.
- **Page padding tightens** at phone width so content (and the scrollable tables) get the full width.

## 2. Scope

- **Reflow / scrollable tables (WCAG 1.4.10).** A global `.table-scroll` utility (`ui/base.css`,
  alongside `.sr-only`): `overflow-x:auto` on a wrapper so a wide table scrolls **on its own**, never
  forcing the whole page to scroll. Applied once in **`ChartFigure`** (`ui/Chart.tsx`) — which every
  Insights table flows through as the chart's data-table fallback, so **all nine** Insights tables are
  covered by one edit — and to the standalone **envelope-ledger** table (`EnvelopeLedger.tsx`). Each
  wrapper is `tabindex="0"` + `role="group"` with an `aria-label`, so the scroll region is reachable
  by keyboard even when it holds no controls of its own (axe `scrollable-region-focusable`).
- **Shell header (`AppShell.module.css`), ≤ 640px.** The banner switches to a stacked column (brand
  above nav), tightened padding, and each nav link gets `min-height` + inline-flex so the wrapped
  links stay comfortable tap targets (WCAG 2.5.8). **No hamburger** — see §3.
- **Insights sub-nav (`Insights.module.css` `.subnav`, wired in `AnalysisSection.tsx`).** Previously
  raw adjacent `<a>`s with no gap (fine at desktop, but they touch and fail **target-size** once
  wrapped at phone width). Now a wrapping flex row with a real gap and a ≥ 24px tap target per tab.
- **Page padding (`ui/base.css`), ≤ 640px.** `main` padding drops from `--space-5` to
  `--space-4`/`--space-3` so narrow viewports reclaim the horizontal room.
- **e2e tsconfig (`tsconfig.e2e.json`).** Added the `DOM` lib (scoped to e2e only) so the new
  `page.evaluate` reflow probe type-checks — Playwright evaluate callbacks run in the browser.

**Out of scope (right-sized, §11):** no mobile-first redesign; no off-canvas / hamburger menu (a new
interactive a11y surface — against this slice's low-risk, desktop-first appetite); no change to the
already-responsive cockpit grid / figure lists / chart SVGs. No data/API/domain change; no dependency.

## 3. Design — degrade gracefully, don't rebuild

- **CSS/token-only, no new dependency.** Media queries (`max-width: 640px`) and one global utility on
  the existing UX4 token sheet + UX3/UX8 modules. Bundle **117.27 KB gz** (+0.07 KB, **no dep**;
  < 120 KB). §11 fast-path — this note is the paperwork; no ADR, no spike.
- **Reflow the right way (WCAG 1.4.10).** Data tables are the standard reflow *exception*: they may
  scroll rather than wrap. The fix scopes the scroll to the table's own region (so the **page** never
  scrolls horizontally) and keeps that region keyboard-operable. `display:block` on `<table>` was
  **rejected** — it can strip native table semantics in some AT; a wrapper preserves them.
- **Nav collapses = graceful degradation, not a menu (owner-visible scope call).** The roadmap line
  says "nav collapses." A true hamburger adds a JS disclosure + focus management — a new interactive
  surface to a11y-test, at odds with the slice's *COMPRESS / low-risk / desktop-first-not-mobile-first*
  mandate. The shell nav **already wraps**; this slice makes that wrap tidy (stacked column, tap
  targets). A hamburger remains an available follow-up if the owner wants it.
- **Charts already scale.** The ADR-0007 SVGs are `width:100%; max-width:…; height:auto` — no chart
  work needed; the contract is untouched.

## 4. A11y coverage

- **Reflow (WCAG 1.4.10):** at 320px the wide Insights table scrolls inside its own region and the
  **page does not scroll horizontally** — asserted directly in e2e (`document.documentElement`
  scrollWidth vs clientWidth).
- **Scrollable-region-focusable:** each `.table-scroll` wrapper is `tabindex="0"` + a named
  `role="group"`, so the scroll region is keyboard-reachable (proven by unit tests on `ChartFigure`
  and `EnvelopeLedger`, and by the narrow axe scan).
- **Target-size (WCAG 2.5.8):** the shell nav links and the Insights sub-nav tabs keep valid tap
  targets when wrapped at phone width (the narrow axe scan caught the sub-nav gap and it is fixed).
- **Non-colour state (WCAG 1.4.1):** the sub-nav active tab is weight + underline, never colour alone.
- **E2E axe (`e2e/a11y.spec.ts`), LIGHT AND DARK at 320px:** a new "responsive reflow at phone width"
  describe seeds the widest table, shrinks the viewport, asserts no horizontal page scroll + the
  focusable scroll region is present, and scans axe-clean in both schemes.

## 5. Acceptance criteria

1. At ~320px, no wide data table forces the whole page to scroll horizontally; the table scrolls in
   its own region instead. ✅
2. Each table scroll region is keyboard-reachable (focusable, named). ✅
3. The shell header and the Insights sub-nav degrade to a usable narrow-column layout with valid tap
   targets (no target-size violation at phone width). ✅
4. The cockpit / figure grids stack and the chart SVGs scale (already true; unregressed). ✅
5. Axe-clean at 320px in **light AND dark**, with a wide table + the reflow layout visible. ✅
6. Gate green; **no new dependency**; bundle within budget. ✅ (366 Vitest passing + 94 e2e;
   **117.27 KB gz** < 120 KB)
