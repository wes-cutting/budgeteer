<!--
STATUS REPORT — UXR9 (Dashboard IA). The FIRST slice of the post-track polish batch (UXR9–UXR12), an
owner-directed batch opened after the UXR1–UXR8 UX Redesign track closed. An IA restructure: the home
and the pay-period planner become two sub-tabs of one Dashboard (Overview + Pay periods), "Home" →
"Dashboard", the standalone /pay-periods route is absorbed (URL preserved), the site-wide sub-tab navs
are centered, and the planner is widened. Presentation/IA only — cockpit + planner byte-for-byte.
Newest report = the live handoff + launch pad for UXR10 (chart X-axis) / UXR11 / UXR12.
-->

# Status Report — 2026-07-07 (UXR9 — Dashboard IA)

| Field  | Value                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                          |
| Date   | 2026-07-07                                                                                        |
| Author | Claude (with the owner)                                                                           |
| Scope  | UXR9 built + `Done`; delta since [2026-07-07-uxr7-manage-form.md](2026-07-07-uxr7-manage-form.md) |

**Resume here:** **UXR9 is `Done` — the first slice of the owner-directed post-track polish batch
(`UXR9`–`UXR12`), opened after the `UXR1`–`UXR8` UX Redesign track closed.** The home (`/`) and the
pay-period planner (`/pay-periods`) are now **two sub-tabs of one Dashboard**: **Overview** (the UX5
cockpit, unchanged) + **Pay periods** (the FEAT-UXR2 two-ledger planner, unchanged). A new pathless
[`DashboardLayout`](../../apps/web/src/DashboardLayout.tsx) route wraps them and renders a **centered**
`<nav aria-label="Dashboard views">` (two `NavLink`s) above the active sub-view; both children carry
`handle: { title: "Dashboard" }`, so the shell `<h1>` (UXR1) reads "Dashboard" on both. In the sidebar,
**"Home" → "Dashboard"** and the Planning group's **"Pay periods" is removed** — the standalone route is
**absorbed** into the Dashboard. Its URL `/pay-periods` is **preserved** as the sub-tab's own address, so
**deep links, the cockpit's Next-paycheck link, and the `/insights/pay-periods` redirect are all
unchanged**. The **site-wide sub-tab navs are centered** (both the new Dashboard nav and Insights'
`.categoryNav`/`.segmentNav` get `justify-content: center`; `.categoryNav` active now also matches
NavLink's `aria-current="page"`), and the **planner `main` is widened to 1200px** (`.widePlanner`,
overriding the global 960px reading measure by class specificity). **Two owner decisions taken up front:**
`/pay-periods` is **absorbed** (not duplicated); Bills + Paychecks stay **together** on the one tab
(preserving the payday→bills highlight) rather than splitting into a three-tab Overview/Bills/Paychecks —
so the width goal is met by widening the tab, not by splitting the panes. **Behavior is byte-for-byte:**
the cockpit and the planner are untouched — **no data/API/domain change**. Blast radius was mechanical:
`AppShell.test` re-pointed (Home→Dashboard; asserts no "Pay periods" sidebar link), e2e `setup`
(`goToDashboard` Home→Dashboard + a new `dashboardViews` helper; `openPayPeriods` now goes via the
Dashboard sub-tab), the `"Home"` `level:1` heading assertions across five specs → `"Dashboard"`, and
`analysis.spec`'s pay-periods active-state moved from the sidebar to the Dashboard sub-tab nav. Gate
**green** — **431 Vitest + 121 e2e** (no count delta: unit + e2e re-pointed, none added); build
**125.27 KB gz** (+0.06 vs 125.21; CSS +0.02 → 5.23; ~14.7 KB under the 140 KB budget). Verified live via
preview (centered nav, wide planner, Bills+Paychecks side-by-side, no console errors). **Next: UXR10
(Insights chart X-axis readability) — §7.**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Dashboard sub-tab shell | New pathless `DashboardLayout` route wraps `{ index: Overview }` + `{ path: "pay-periods" }`; renders a centered `.categoryNav` sub-tab nav (`aria-label="Dashboard views"`) + `<Outlet/>`; both children `handle: { title: "Dashboard" }` | [`DashboardLayout.tsx`](../../apps/web/src/DashboardLayout.tsx) · [`routes.tsx`](../../apps/web/src/routes.tsx) |
| "Home" → "Dashboard"; Pay periods absorbed | Sidebar Budget item renamed (`to="/"` `end`, HomeIcon kept); Planning group's "Pay periods" item + the `PayPeriodsIcon` import removed; the standalone `/pay-periods` route dropped (its URL lives on as the sub-tab; `/insights/pay-periods` still redirects to it) | [`AppShell.tsx`](../../apps/web/src/AppShell.tsx) · [`routes.tsx`](../../apps/web/src/routes.tsx) |
| Centered site-wide sub-tab navs | `.categoryNav` + `.segmentNav` gain `justify-content: center`; `.categoryNav` active now matches `a.categoryActive, a[aria-current="page"]` so the Dashboard NavLinks light (Insights' `<Link>` + `.categoryActive` path unchanged) | [`Insights.module.css`](../../apps/web/src/Insights.module.css) |
| Wider planner | `PayPeriodsView`'s `<main>` gains `.widePlanner` (`max-width: 1200px`) | [`PayPeriodsView.tsx`](../../apps/web/src/PayPeriodsView.tsx) · [`Insights.module.css`](../../apps/web/src/Insights.module.css) |
| Tests | `AppShell.test` re-pointed; e2e `setup` (`goToDashboard`, `openPayPeriods`, new `dashboardViews`); `"Home"` `level:1` → `"Dashboard"` in `a11y`/`quick-add`/`routing`/`app-shell`/`error-boundary`; `analysis.spec` pay-periods active-state → Dashboard sub-tab nav | unit + `e2e/` |
| Docs | New [UX spec](../ux/dashboard-ia.md) `Implemented`; roadmap (new UXR9–UXR12 subsection + focus/next-fronts + §5 log); `07_NFR` §1³ bundle delta (+0.06 → 125.27); this report | this change |

## 2. Definition of Done — current state (an IA restructure, presentation-only)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | `/` renders the Dashboard with Overview (cockpit) active; the sub-tab nav switches to `/pay-periods` (the two-ledger planner) — both under one "Dashboard" `<h1>`. Selecting a payday still highlights its covered bills (panes kept together). No data/API/domain change — verified live via preview. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** — **431 Vitest + 121 e2e**, build **125.27 KB gz**, audit clean at `--audit-level=critical` (3 pre-existing *high* advisories below the gate threshold). |
| Acceptance criteria met & tested (UX spec §6) | ✅ | Sidebar shows "Dashboard" (not "Home"); Dashboard sub-tab nav marks Overview/Pay periods; `/pay-periods` deep link + `/insights/pay-periods` redirect land on the Pay periods sub-tab (e2e); cockpit Next-paycheck link still targets `/pay-periods` (`Cockpit.test` unchanged, passing); both sub-tab navs centered (preview-inspected `justify-content: center`); planner `main` = 1200px (preview-inspected). |
| A11y (WCAG 2.2 AA) | ✅ | Labeled nav landmark (`Dashboard views`) distinct from the sidebar (`Primary`); active = weight + underline edge + `aria-current="page"` (NavLink); exactly one `<h1>` per route (`app-shell.spec` heading-integrity passes); axe light AND dark on the Dashboard (`a11y.spec` cockpit scans, "Home"→"Dashboard" re-pointed); 320px reflow of the planner (`a11y.spec` pay-periods reflow, via the re-pointed `openPayPeriods`). |
| Input validation & secrets | ✅ | No schema/endpoint change; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | UX spec (`Implemented` +§8) · roadmap (UXR9–12 rows + focus + §5) · `07_NFR` §1³ · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 431 | 431 | 0 — `AppShell.test` re-pointed (Home→Dashboard; no "Pay periods" sidebar link) but no spec added; the rename is a label/title change the existing tests cover |
| E2E | 121 | 121 | 0 — the `"Home"` heading assertions, `setup` nav helpers, and `analysis.spec` pay-periods active-state were re-pointed (not added); `/pay-periods` URL + redirect coverage carried |

## 4. Design notes / small calls

- **Two tabs, not three — the owner chose to keep Bills & Paychecks together.** The original ask was
  Overview/Bills/Paychecks (three tabs), which would have given each ledger full width. But splitting
  them loses the interactive "click a payday → highlight its covered bills" join (the panes are no longer
  on screen together). Flagged; the owner chose to **keep the panes together** and get the width another
  way — so the Dashboard has **two** sub-tabs and the planner `main` is widened to 1200px instead.
- **`/pay-periods` is absorbed, not duplicated — and its URL is preserved.** The standalone route is gone
  from the sidebar and `routes.tsx`, but the path lives on as the sub-tab's own address. That keeps every
  existing `/pay-periods` deep link, the `/insights/pay-periods` redirect, and the cockpit's Next-paycheck
  `<Link>` working with **zero** changes to those call sites (`Cockpit.test` needed no touch).
- **Routing kept `/` and `/pay-periods` rather than reparenting under `/dashboard`.** A `/dashboard`
  prefix would let the sidebar item prefix-match both sub-tabs (like Insights), but at the cost of
  redirecting `/` and rewriting every `/pay-periods` URL assertion + the cockpit link + the catch-all
  test. Keeping the URLs stable (a pathless `DashboardLayout` wrapper) was far less churn; the trade is
  that the sidebar "Dashboard" item lights only on `/` (the Dashboard sub-tab nav + the "Dashboard"
  `<h1>` carry the location on the Pay periods sub-tab).
- **The sub-tab nav reuses Insights' `.categoryNav`.** `PayPeriodsView` already imports
  `Insights.module.css`, so that sheet is the shared analysis/planning treatment, not Insights-only —
  reusing `.categoryNav` for the Dashboard nav keeps one centered sub-tab-nav style, satisfying the
  owner's "center the site-wide sub-tab navs" in one place.
- **Pay-period grouping is per-account by design (owner's question, answered — no change).** The planner
  is one plan for the account picked in its dropdown, because a plan is a running projection of **one
  account's** cash balance (its starting balance + the deposits that land in it + the withdrawals drawn
  from it). Multiple checking accounts → switch the dropdown; there is no multi-account fan-out. A known
  FEAT-S7 characteristic, out of scope for this polish pass.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR9) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR9 code | Not blocking; watch |
| **Polish batch continues** — `UXR10`–`UXR12` `Planned` | UXR10 chart X-axis readability · UXR11 add-transaction (remove Accounts button + modal form on the pattern) · UXR12 Manage formatting | Owner picks order (all presentation-only) |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); a **dev stack**
  (`npm run dev` + `tsx watch`) auto-respawns on those ports, so **stop it before running e2e** (the
  `tsx watch` API restarts on crash; kill the `npm run dev` + `tsx watch` parents, not just the leaves).
- **Dashboard** = `/` (Overview cockpit) + `/pay-periods` (Pay periods planner), two sub-tabs of the
  pathless `DashboardLayout`; the shell `<h1>` is "Dashboard" for both. Sidebar "Dashboard" → `/`.
- **Sub-tab navs** (Dashboard + Insights) use `.categoryNav`/`.segmentNav` in `Insights.module.css`,
  now **centered**. Forms → `FormLayout.module.css`. Ledger tables → `Ledgers.module.css`.
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr9-dashboard-ia.md — its
  "Resume here" has state (UXR9 Dashboard IA is Done; gate green at 431 Vitest + 121 e2e, build
  125.27 KB gz; the two pre-existing e2e flakes are watch-only).
- Read docs/03_ROADMAP.md — the "UX Redesign — post-track polish (UXR9–UXR12)" subsection in §4 and
  the "Next fronts" line show what's left in the batch.

The owner-directed post-track polish batch (UXR9–UXR12) is underway. UXR9 (Dashboard IA) is DONE.
Continue with the batch — all presentation-only, ordering is the owner's call:
- UXR10 — Insights chart X-axis readability: the categorical/line chart X-axis labels (long envelope
  names) overlap and thin out unreadably; slant them (~-35°) and show more, in the shared
  apps/web/src/ui/Chart.tsx (LineChart + BarChart; affects all Insights charts).
- UXR11 — Add-transaction: remove the page-local "Add transaction" button on /accounts
  (apps/web/src/AccountsList.tsx); re-lay the quick-add modal form (apps/web/src/AddTransactionForm.tsx,
  still raw <label>/<select>/<input>) on the FormLayout.module.css pattern the other forms use.
- UXR12 — Manage page formatting: re-lay ManageView (net-worth table + management links) on the
  design-system table/section treatment (Ledgers.module.css).

Confirm the next item with the owner if unsure. Keep it vertical and gate-green; update docs in the
same change; leave the project handoff-ready with a next-session kickoff prompt. NOTE: the e2e gate
needs ports 3001/5173 free — a running dev stack (npm run dev + tsx watch) must be stopped first.
Provide a single-line short commit message; the owner reviews and commits.
```
