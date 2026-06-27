<!--
UX UPLIFT — initiative brief / thorough backlog. Captured 2026-06-25 from a design session
with the owner. Companion to the plan of record (docs/03_ROADMAP.md), which tracks these as
items UX1–UX15. This brief holds the depth; the roadmap stays the single source of truth.
Pattern mirrors reviews/2026-06-17-improvement-review.md → the R-items.
-->

# UX Uplift — initiative brief & backlog

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Status       | Proposed (draft) — owner-aligned on framing; items not yet `Ready`    |
| Owner        | Wesley Cutting                                                         |
| Captured     | 2026-06-25                                                            |
| Tracked in   | [`03_ROADMAP.md`](../03_ROADMAP.md) → "UX Uplift" track (`UX1`–`UX15`) |
| Sources      | design session 2026-06-25 · [`02_PRD.md`](../02_PRD.md) · the current `apps/web` surface · [`reviews/2026-06-17-improvement-review.md`](2026-06-17-improvement-review.md) (the R-series precedent) |

> **Why a brief and not a standalone backlog doc?** The roadmap's
> [2026-06-17 entry](../03_ROADMAP.md) records that a parallel working backlog
> (`03b_IMPROVEMENTS.md`) was **deleted** so the roadmap stays the *single plan of record*.
> This brief follows the established pattern instead: a dated review captures the thinking,
> and the **tracked, sequenced items live in the roadmap**.

---

## 1. Why this initiative

V1 is **functionally complete and gate-green** (275 Vitest + 47 e2e): the domain core, the
full enter→allocate loop, transfers/refunds/recurring/reconcile, the six-view analysis area,
and the a11y/perf/CI hardening are all built. What has *not* been invested in — deliberately —
is the **experience**:

- **No visual design.** [`apps/web/src/index.css`](../../apps/web/src/index.css) is a 14-line
  WCAG-compliance floor (a `min-height: 24px` touch-target rule and nothing else), explicitly
  "no design system, no layout overrides." Every screen renders as raw browser-default HTML —
  unstyled `<button>`, `<table>`, `<ul>`, and always-on inline `<form>`s.
- **Hand-rolled navigation.** [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx) is a
  `useState`-driven `view` state machine — no URLs, no browser back/forward, a refresh drops
  you to the dashboard, and every screen carries a manual "← Dashboard" button.
- **The home is a 551-line console, not an overview.**
  [`Dashboard.tsx`](../../apps/web/src/Dashboard.tsx) is simultaneously the landing page, the
  account manager, the envelope manager, the net-worth snapshot, and the launchpad.
- **The primary daily action is buried.** Quick single-envelope entry (PRD journey #1, "the
  common case — must stay fast") lives one level down, inside an account register; the home
  has no "Add transaction."
- **Analysis is table-only.** The six analysis views render grids of numbers, not pictures —
  yet "visualize spending in new ways" was a *primary motivation* for leaving the spreadsheet.

The bones are excellent (strong a11y, integer-cents money, derived balances, clean service
boundaries). This initiative invests in the **surface and the flow** on top of them.

### Owner's stated priorities (design session 2026-06-25)

1. **Router-based page framework** — explicitly important; the structural reframe.
2. **Budget overview prominent on the landing page** — the owner's 12-year spreadsheet *started*
   on the budget-with-future-planning page; the home should be forward-looking, not a CRUD console.
3. **New ways to visualize spending habits** — a core reason for moving off the spreadsheet; this
   is elevated from "polish" to a first-class theme.

### Framing decisions (owner-confirmed)

- **Appetite: foundation-first.** Invest in a design system + routing/app-shell, then migrate
  screens as vertical slices — not a cosmetic coat of paint.
- **Devices: desktop-first.** Optimize for desk use (matches the PRD's single-user-at-a-desk
  framing); stay responsive enough not to break on a phone, but not mobile-first.

## 2. Vision — the experience we're building toward

> Open the app and land on a **budget cockpit**: this month's envelope health at a glance, what's
> coming (upcoming recurring + a cash-flow projection), anything that needs allocation, and a
> net-worth snapshot. One always-available **Add transaction** for the daily case. A persistent,
> URL-addressable shell you can deep-link and navigate with the browser. And an **Insights** area
> that *shows* spending — trends, breakdowns, burn-down — not just tabulates it. All of it as
> accessible as the current bare HTML, and reconciled to the penny by the same derived ledger.

## 3. Principles & non-negotiables (carried, not relaxed)

These bind every slice in this initiative — the uplift does **not** get to trade them away:

- **Accessibility stays WCAG 2.2 AA, axe-clean.** Every migrated/new surface passes the
  `e2e/a11y.spec.ts` axe scan; **color is never the sole signal**; keyboard + screen-reader
  paths work; `prefers-reduced-motion` gates all animation; `prefers-color-scheme` honored.
  *(This is the central tension for the charting theme — see §4.3.)*
- **Boundaries hold.** Presentation stays thin and never touches the datastore; it talks only to
  the API via [`api.ts`](../../apps/web/src/api.ts). New views derive from existing endpoints
  wherever possible (the R4/R5 pattern); new server reads are added only when genuinely needed.
- **Vertical, usable slices, gate-green.** Each item ships data→API→UI in one increment that
  passes the full gate (typecheck · lint · format · unit/integration · e2e incl. a11y · build ·
  SCA). No half-styled app states between slices; the app is usable at every step.
- **Reality before paper.** The foundation choices (design system, routing, charting) are
  **spike-validated on one real screen before** specs/ADRs are accepted — `Decided ≠ Validated`.
- **No financial data in logs or commits;** synthetic fixtures only (unchanged from V1).
- **Derive, don't store.** Cockpit/insight figures are computed from the ledger, never a second
  source of truth that can drift.

## 4. Foundation decisions (must be settled first — ADR-gated, spike-first)

The uplift **reverses the repo's deliberate "no design system" stance**, so the foundation is a
real decision set, each producing an ADR validated by a spike. Per CLAUDE.md, this divergence is
flagged here rather than taken silently. Leans below are *Proposed*, not Accepted.

### 4.1 Design system & styling → `ADR-0005` (produced by `UX1`)

| Option | Trade-off |
| ------ | --------- |
| **(lean) CSS custom-property tokens + component-scoped CSS Modules** | Zero runtime dep, legible diffs, full a11y control, matches the repo's restraint. Most manual. |
| Tailwind | Fast to compose, but a philosophical shift + JSX churn; larger toolchain change. |
| CSS-in-JS (vanilla-extract / styled-components) | Co-located styles, but a runtime/bundle cost and a heavier dependency. |

**Lean:** design tokens (color, type scale, spacing, radius, elevation) as CSS custom properties
+ component-scoped CSS, **plus a tiny headless-a11y primitive lib** (React Aria Components *or*
Radix Primitives) used **only** for the genuinely hard interactive widgets — dialog, menu, toast,
tabs — so we don't hand-roll (and regress) focus management. Dark mode falls out of the token sheet.

### 4.2 Client routing → `ADR-0006` (produced by `UX1`)

| Option | Trade-off |
| ------ | --------- |
| **(lean) React Router (data router)** | Conventional, Vite-friendly, well-understood; URL-addressable, back/forward, nested layouts. |
| TanStack Router | Stronger type-safety, but newer/heavier for this app's needs. |
| Hash routing / hand-rolled | Lowest dep, but loses real history semantics and deep-link cleanliness. |

**Lean:** React Router with a persistent root layout (the app shell) and nested routes; the
existing `view` state machine is retired. Proposed route map (refined in `UX3`):

```
/                         Home — budget + future-planning cockpit
/accounts                 Manage accounts        /accounts/:id        Account register
/envelopes                Manage envelopes       /envelopes/:id       Envelope ledger
/transactions/new         Global quick-add (modal route)
/needs-allocation         Needs-allocation queue
/templates  /recurring  /reconcile               Supporting flows
/insights                 Insights hub           /insights/:view      spend·budget·forecast·credit·payoff·net-worth
/manage                   Settings / management + Download backup
```

### 4.3 Charting & visualization a11y → `ADR-0007` (produced by `UX2`)

The hard one. Most charting libraries **fail an axe scan** and are keyboard/SR-hostile — which
collides head-on with the project's a11y standard.

| Option | Trade-off |
| ------ | --------- |
| **(lean) Hand-rolled accessible SVG + a data-`<table>` fallback** | Full control over roles/labels/keyboard + a guaranteed tabular equivalent; data volumes here are small. More build effort per chart. |
| visx (low-level SVG primitives) | Less boilerplate than raw SVG, still unstyled/SVG so a11y is controllable; a dependency. |
| Recharts / Chart.js / Observable Plot | Fast to ship, but a11y must be retrofitted (often `<canvas>` = invisible to SR) and may not pass the gate. |

**Lean:** start hand-rolled SVG (bar/line) with proper `role`/`aria` + an always-available
(toggle or visually-hidden) **data-table fallback**; reach for visx only if complexity grows.
The `UX2` spike *proves* one chart passes axe + keyboard + SR before the area commits.

> **No ADR is pre-written.** Per the spike-first rule, `ADR-0005/0006/0007` are **produced with
> their spikes** (`UX1`, `UX2`), exactly as `SPIKE-02` produced `ADR-0001/0002`.

## 5. The backlog

Fifteen items in four phases, sequenced front-loaded-risk / validate-value-early. **Value/Effort/
Risk** are High/Med/Low. Statuses use the roadmap vocabulary
(`Planned · Ready · In progress · Done · Deferred · Dropped`).

| # | Item | Phase | Kind | Value | Effort | Risk | Gated by | Status |
| - | ---- | ----- | ---- | ----- | ------ | ---- | -------- | ------ |
| UX1 | Spike: design-system + routing foundation (convert 1 screen end-to-end) → `ADR-0005`/`ADR-0006` | 0 Foundation | spike | High | Med | High | — | Planned (next) |
| UX2 | Spike: accessible charting / viz a11y (convert 1 chart) → `ADR-0007` | 0 Foundation | spike | High | Med | High | — | Planned |
| UX3 | Routing + persistent app shell (retire the `view` state machine) | 1 Shell | slice | High | High | Med | UX1 | Planned |
| UX4 | Design tokens + base component library (incl. dark mode) | 1 Shell | slice | High | High | Med | UX1 | Planned |
| UX5 | Home: budget + future-planning cockpit | 2 Cockpit | slice | High | High | Med | UX3, UX4 | Planned |
| UX6 | Demote management to a dedicated surface | 2 Cockpit | slice | Med | Med | Low | UX3, UX4 | Planned |
| UX7 | Global quick-add transaction | 2 Cockpit | slice | High | Med | Med | UX3, UX4 | Planned |
| UX8 | Analysis → **Insights**: migrate 6 views to design system + accessible charts | 3 Insights | slice | High | High | Med | UX2, UX3, UX4 | Planned |
| UX9 | New viz: spending breakdown ("where did the money go") | 3 Insights | slice | High | Med | Med | UX2, UX8 | Planned |
| UX10 | New viz: spending trends over time + month-over-month | 3 Insights | slice | High | Med | Med | UX2, UX8 | Planned |
| UX11 | New viz: budget burn-down (within-month pace vs. target) | 3 Insights | slice | Med | Med | Med | UX2, UX5 | Planned |
| UX12 | Feedback & states: skeletons, toasts, destructive-action confirms, inline validation | 4 Polish | slice | Med | Med | Low | UX4 | Planned |
| UX13 | Money & budget-health visual encoding (progress bars, weight + color, never color-only) | 4 Polish | slice | Med | Med | Low | UX4 | Planned |
| UX14 | Empty states & first-run onboarding | 4 Polish | slice | Med | Med | Low | UX3, UX4 | Planned |
| UX15 | Responsive pass (desktop-first → graceful phone) | 4 Polish | slice | Med | Med | Low | UX3, UX4 | Planned |

### Phase 0 — Foundation (de-risk the bet)

**UX1 — Spike: design-system + routing foundation.** → **scoped as
[SPIKE-06](../spikes/06-design-system-routing.md)** (2026-06-25).
*What:* a **bake-off** (owner chose compare-alternatives over single-hypothesis validation) across
three axes — routing (**React Router** vs **TanStack Router**) × styling (**CSS tokens + CSS
Modules** vs **Tailwind**) × a11y primitives (**React Aria** vs **Radix**) — by **converting the
Account Register end-to-end** (owner-chosen probe; it exercises a table, forms, row actions,
filters, money formatting, navigation, and the allocation editor as a real Dialog).
*Why:* everything downstream rides on these choices; converting a real screen proves them against
reality before any spec is accepted. *Riskiest assumption:* some combination yields styled,
**axe-clean** components at an acceptable bundle cost, and routing migrates without breaking the
existing e2e/a11y suites — with a11y a **hard disqualifying gate**. *Produces:* `ADR-0005`
(styling), `ADR-0006` (routing), the spike report, and a measured web-bundle budget. *Out of
scope:* migrating other screens, the full component library, the cockpit (that's UX3/UX4/UX5+).
*Acceptance:* the Account Register lives at a real URL with back/forward/refresh, styled via
tokens (incl. dark mode), the allocation editor is an accessible Dialog, the axe scan stays green
in light + dark, the bundle delta is recorded within budget; ADRs `Validated` by the spike.

**UX2 — Spike: accessible charting / viz a11y.**
*What:* build **one** real chart (candidate: spend-by-envelope as a bar chart) the chosen way and
prove it passes axe + keyboard + screen-reader, with a data-table fallback. *Why:* charts are the
motivating feature *and* the biggest a11y risk; settle the approach on one before committing the
Insights area. *Riskiest assumption:* we can ship attractive charts that still pass the gate.
*Produces:* `ADR-0007` (charting & viz a11y), a spike report, a reference chart component.
*Acceptance:* the chart renders, has a tabular equivalent, and passes the axe scan + keyboard nav.

### Phase 1 — Shell & foundation build

**UX3 — Routing + persistent app shell.**
*What:* retire `App.tsx`'s `view` state machine; introduce React Router with a persistent root
layout (header + primary nav + content outlet), implementing the §4.2 route map. Deep-linkable,
refresh-safe, real back/forward; reduced-motion-aware transitions; the per-screen "← Dashboard"
buttons go away. *Gated by:* UX1. *Out of scope:* restyling each screen's internals (UX4) and the
cockpit reframe (UX5). *Acceptance:* every existing screen reachable by URL; e2e specs re-pointed
to navigate via the shell; a11y green; no orphaned navigation.

**UX4 — Design tokens + starter primitives.** → **scoped as
[FEAT-UX4](../features/design-system.md)** (2026-06-25).
*What:* the styled vocabulary every screen reuses, on the token sheet with **dark mode** via
`prefers-color-scheme`. **Seed-and-grow** (owner decision): build the token sheet + only the
**starter primitives the first screen needs** — `Button`, `Field`/`Input`/`Select`, `Table`,
`Badge`, `Dialog` (Radix), `Alert`, `EmptyState`, `Skeleton` — and **prove them by restyling the
Account Register in place** (current nav unchanged); the rarer primitives (`Menu`, `Toast`, `Tabs`,
`ProgressBar`) are added by the later slices that first need them. *Why seed-and-grow:* a whole
component library no screen uses is a horizontal layer (against *vertical, not horizontal*), so UX4
is a vertical slice instead. *Sequencing:* **UX4 runs before UX3** — an in-place restyle needs no
routing; UX3 swaps in React Router after. *Gated by:* UX1 (done). *Acceptance:* primitives
unit-tested; the Account Register recomposed onto them with no ad-hoc inline styles, flow
unchanged; **axe green in light AND dark**; gate green; no data/API/domain change.

### Phase 2 — The landing cockpit (highest value)

**UX5 — Home: budget + future-planning cockpit.**
*What:* replace the console home with a forward-looking overview that **composes existing data** —
this-month envelope health (target/spent/remaining), upcoming recurring (what's due, projected
balances), a cash-flow-forecast snapshot, the needs-allocation callout, and the net-worth snapshot.
*Why:* the owner's #2 priority and the thing they've wanted since the spreadsheet. *Boundaries:*
derive from existing endpoints (`budget-vs-actual`, `cash-flow-forecast`, `recurring`,
`net-worth`, `needs-allocation`) before adding any aggregate. *Gated by:* UX3, UX4. *Open Q:* does
the cockpit need a single new "home summary" endpoint, or can it fan out to existing ones (R4/R5
precedent says fan-out first)? *Acceptance:* home loads the cockpit at `/`, each panel deep-links
to its detail surface, figures reconcile to the ledger, a11y green.

**UX6 — Demote management to a dedicated surface.**
*What:* move account/envelope create·rename·archive and "Download backup" off the home into a
`/manage` (settings) surface and the `/accounts` · `/envelopes` list routes; the always-on add
forms become progressive (behind an "Add" affordance). *Why:* management stops being the main
event once the cockpit is the home. *Gated by:* UX3, UX4. *Acceptance:* all management still
reachable + tested; home no longer renders add-forms; a11y green.

**UX7 — Global quick-add transaction.**
*What:* an always-available "Add transaction" entry (a modal route `/transactions/new`,
keyboard-invokable) for PRD journey #1, pre-fillable with account + single-envelope allocation,
with split available inline. *Why:* the most common action is currently buried in a register.
*Gated by:* UX3, UX4 (reuses the existing allocation editor). *Acceptance:* a transaction can be
entered + allocated from anywhere in the app without first navigating to an account; needs-
allocation surfacing unaffected; a11y green.

### Phase 3 — Spending visualization / Insights

**UX8 — Analysis → Insights migration.**
*What:* rename the area to **Insights**, migrate the six existing views (spend, budget, forecast,
credit, payoff, net-worth) onto the design system, and **replace the number grids with accessible
charts** (chart + data-table fallback, per `ADR-0007`). *Gated by:* UX2, UX3, UX4. *Acceptance:*
each view keeps its data correctness + axe-green status, now rendered visually with a tabular
equivalent.

**UX9 — New viz: spending breakdown.**
*What:* a "where did the money go" composition for a chosen period (per-envelope / category share
of outflow). Likely derivable from the existing envelope-spend aggregate. *Gated by:* UX2, UX8.
*Open Q:* exact grouping (envelope vs. a future category concept) — settle in the feature spec.

**UX10 — New viz: spending trends over time.**
*What:* per-envelope and total spending trend lines + month-over-month comparison. Builds on the
existing monthly/annual spend rollups. *Gated by:* UX2, UX8.

**UX11 — New viz: budget burn-down.**
*What:* within-month pace vs. target — are you on track to stay under each envelope's target, given
elapsed days and spend so far. Pairs with the cockpit (UX5). *Gated by:* UX2, UX5.

### Phase 4 — Compounding polish (woven in as screens migrate, but tracked)

**UX12 — Feedback & states.** Skeleton loaders (replacing bare "Loading…"), success toasts,
**confirmation on destructive actions** (Archive/Delete — currently one-click, no confirm), and
clearer inline validation surfaces. *Gated by:* UX4.

**UX13 — Money & budget-health visual encoding.** Progress bars for target-vs-spent / utilization /
payoff; weight + color for over-budget, liabilities, net worth — **always paired with text/shape,
never color alone** (a11y). Supersedes the V1 "minus sign only" encoding. *Gated by:* UX4.

**UX14 — Empty states & first-run onboarding.** Guided empty app → "add your first account, add
your envelopes," tied directly to the PRD's success metric ("still keeping it current past week
one"). *Gated by:* UX3, UX4.

**UX15 — Responsive pass.** Desktop-first layouts that degrade gracefully to phone width (nav
collapses, tables reflow/scroll, the cockpit stacks). *Gated by:* UX3, UX4.

## 6. Sequencing & where to start

```
UX1 ─┬─► UX3 ─┬─► UX5 ─┐
     │        ├─► UX6  ├─► (Phase 2 cockpit usable)
UX2 ─┘   UX4 ─┴─► UX7 ─┘
              │
UX2 ──────────┴─► UX8 ─► UX9 / UX10 / UX11   (Phase 3 insights)

UX12–UX15  woven into each slice as it migrates; tracked so none are dropped.
```

**Start here: `UX1`** — the design-system + routing spike. It retires the single biggest unknown
(can we get styled, accessible, routed React without regressing the a11y gate?) and produces the
two ADRs everything else depends on. `UX2` (charting spike) can run in parallel or immediately
after. Only once both are `Validated` do the Phase-1 build slices (`UX3`, `UX4`) begin.

## 7. Risks & open questions

| # | Risk / question | Bearing | Resolution path |
| - | --------------- | ------- | --------------- |
| 1 | **Accessible charts may not look as good as inaccessible ones** — the a11y standard constrains the viz toolset. | UX2, UX8–UX11 | `UX2` spike proves one chart passes the gate before the area commits; data-table fallback is mandatory. |
| 2 | **Big-bang restyle risk** — migrating all screens at once would break the "usable at every step" rule. | Whole initiative | Strictly vertical slices; the shell (UX3) tolerates a mix of styled/unstyled screens during migration. |
| 3 | **Cockpit fan-out vs. new endpoint** — composing 5 existing reads on the home may be chatty. | UX5 | Fan out first (R4/R5 precedent); add a `home-summary` aggregate only if perf budgets demand it. |
| 4 | **Routing changes break the e2e/a11y suites** — they currently navigate the `view` machine. | UX3 | Re-point `e2e/setup.ts` helpers as part of UX3; the suite is the regression net. |
| 5 | **Scope creep into multi-user.** Shell/nav must not pre-build auth/household switching (still post-V1, item `#19`). | UX3 | Design the shell to *accommodate* future account scoping without building it (PRD §8). |
| 6 | **Dependency footprint** — a router + a headless-a11y lib + (maybe) a chart lib add deps to a lean repo. | UX1, UX2 | ADRs record the bundle/dep cost; SCA gate (`npm audit`) still applies; prefer the smallest viable libs. |

## 8. How this maps to the roadmap & the artifacts each item produces

- **Plan of record:** the roadmap's new **"UX Uplift"** section tracks `UX1`–`UX15` with live
  statuses; this brief is linked from its Sources and intro. Re-sequencing is logged in §5 there.
- **Per item, as gating work** (written *with* the slice, per the doc map): a **UX spec**
  (`docs/ux/`) and, where there's real logic, a **feature spec** (`docs/features/`); the
  foundation spikes additionally produce **ADRs** (`ADR-0005/0006/0007`) and **spike reports**
  (`docs/spikes/`). Every item closes with a **status report** whose outline is the Definition of
  Done, and each milestone ends handoff-ready with a next-session kickoff prompt (CLAUDE.md).
- **Definition of Done is unchanged:** gate-green (incl. the axe scan), docs updated in the same
  change, no secrets/financial data leaked.

> **Status: `Proposed` (draft).** Framing is owner-aligned; the items are `Planned`, not `Ready`.
> The initiative becomes real one spike at a time — `UX1` first.
