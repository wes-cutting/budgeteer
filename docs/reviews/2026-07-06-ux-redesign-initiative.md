<!--
UX REDESIGN — initiative brief / capture doc. Opened 2026-07-06 from an owner design session
working from a reference dashboard screenshot. Companion to the plan of record
(docs/03_ROADMAP.md), which tracks these as the UXR items. This brief holds the depth; the
roadmap stays the single source of truth. Pattern mirrors
reviews/2026-06-25-ux-uplift-initiative.md → the UX items.
-->

# UX Redesign — initiative brief & backlog

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Status       | **Proposed** — capture complete 2026-07-07 (`UXR1`–`UXR8`); owner-aligned |
| Owner        | Wesley Cutting                                                          |
| Captured     | 2026-07-06 → 2026-07-07 (session ongoing)                               |
| Tracked in   | [`03_ROADMAP.md`](../03_ROADMAP.md) → "UX Redesign" track (`UXR1`+)     |
| Sources      | owner design session 2026-07-06 (reference dashboard screenshot) · the shipped UX Uplift ([brief](2026-06-25-ux-uplift-initiative.md), `UX1`–`UX15`) · the current `apps/web` surface |

> **Capture status: complete** (owner-confirmed 2026-07-07). The initiative is `UXR1`–`UXR8`:
> the shell (`UXR1`), the planner (`UXR2`), and the per-page batch (`UXR3`–`UXR8`). Any new
> idea gets a new item + log row — this brief no longer grows silently.

---

## 1. Why this initiative

The **UX Uplift (`UX1`–`UX15`) is complete**: design tokens + primitives, React Router + a
persistent shell, the cockpit home, the Insights charts, and the polish passes all shipped
gate-green. What that initiative deliberately did *not* do is give the app a **product-grade
application frame** — the shell is still a minimal top banner with a wrapped horizontal link
row ([`AppShell.tsx`](../../apps/web/src/AppShell.tsx)), and each page manages its own title
and width.

The owner now wants the app's layout aligned with a **reference dashboard design** (screenshot
from the 2026-07-06 session — a dark-theme SaaS dashboard, "Efferd"): a grouped, icon-labeled
**left sidebar** with a brand header and utility footer; a **top bar** carrying a sidebar
toggle, the current page title, and the page-level actions; and a **full-width content canvas**
of cards/panels. The redesign borrows that **chrome and structure** — not the reference's
content (fake SaaS metrics, notifications, avatars, team features).

> **Reference asset:** the screenshot lives in the 2026-07-06 session; when convenient, save it
> to `docs/ux/assets/2026-07-06-dashboard-reference.png` so the specs can link it.

### What we take from the reference

- **Grouped sidebar navigation** — labeled sections (the reference: Product / Workspace /
  Administration) instead of one flat link row; icon + label per item; collapsible.
- **Top bar** — sidebar toggle · current page title · right-aligned actions.
- **Content canvas** — the page area reads as a full-width composition of cards, not a
  960px centered column.

### What we explicitly do NOT take

- **Notifications, avatar/user menu, share/send** — Budgeteer is single-user, no-auth
  (auth/multi-user is deferred `#19`). The shell should leave *room* for these, not build them
  (the UX-Uplift's scope guard, unchanged).
- **Changelog card / Help Center / Documentation footer** — no analog; per the Q1/Q2
  resolutions (2026-07-06) Download backup files under **Administration** and the footer slot
  instead carries the global **Add transaction** (the nav's primary action).
- **The reference's data widgets as-is** — cockpit/page content changes are their own items
  (`UXR2`+), captured per page, not smuggled into the shell slice.

## 2. Principles & non-negotiables (carried, not relaxed)

Identical to the UX-Uplift brief §3 — the redesign does not get to trade them away:
**WCAG 2.2 AA / axe-clean (light AND dark), color never the sole signal, keyboard + SR paths,
`prefers-reduced-motion` gates all animation** · presentation stays thin (client-only UI state
like sidebar collapse never becomes API state) · **vertical, usable, gate-green slices** ·
derive-don't-store · no financial data in logs/commits.

## 3. Known tensions (named up front, decided at spec/Ready time)

| # | Tension | Bearing | Where it's worked |
| - | ------- | ------- | ----------------- |
| 1 | **The web-bundle budget is nearly spent** — 118.67 of the (then) 120 KB gz budget (~1.3 KB left after S7). A sidebar shell needs an **icon set** (the app has none today) plus collapse/drawer JS; that didn't fit. The S7 roadmap entry predicted "the next UI-bearing slice likely forces the budget conversation" — this was that slice. | UXR1 | **Resolved 2026-07-06** — owner re-baselined **120 → 140 KB gz** ([`07_NFR` §1³](../07_NFR.md) holds the record; 200 was floated and rejected as too loose to ever bind). 140 funds the whole initiative while keeping dependency-class additions a deliberate call; the UX spec still leans hand-rolled SVGs (§11 Q4). |
| 2 | **Top-bar page title vs. one-`<h1>`-per-page** — every view renders its own `<h1>` today (an axe-suite invariant). If the top bar shows the page title, either the shell owns the `<h1>` (route-handle titles; every view + its tests change) or the top-bar title is secondary text (cheaper, but the page then shows its name twice). | UXR1 | **Resolved 2026-07-06** — the **shell owns the `<h1>`**: route-handle titles for static pages + a shell title context that dynamic views (register · ledger) publish their resolved name into (kind-label fallback until data arrives); `document.title` synced; views drop their `<h1>`s, content headings start at `<h2>`. Recorded in [UX spec §8 + §11 Q3](../ux/app-shell-sidebar.md); mechanism formalized in FEAT-UXR1. |
| 3 | **A narrow-screen drawer reverses UX15's "no hamburger" scope call.** UX15 chose graceful degradation and *recorded* the hamburger as "an available follow-on" — a drawer/hamburger is a new interactive a11y surface (focus trap, Esc, restore). This initiative **deliberately supersedes** that call; the drawer rides on the proven `Dialog` focus machinery rather than hand-rolling it. | UXR1 | UX spec §4/§6; the a11y bar is in the acceptance criteria. |
| 4 | **e2e blast radius** — the suites navigate via the shell (`e2e/setup.ts` helpers). Swapping the chrome re-points the helpers; the drawer/rail add axe states to scan. | UXR1 | Same pattern as UX3 (the helpers absorbed the last shell swap); called out in acceptance. |

## 4. The backlog

Statuses use the roadmap vocabulary (`Planned · Ready · In progress · Done · Deferred ·
Dropped`). **Capture complete 2026-07-07 — `UXR1`–`UXR8` is the full initiative.**

| # | Item | Kind | Value | Effort | Risk | Gated by | Status |
| - | ---- | ---- | ----- | ------ | ---- | -------- | ------ |
| UXR1 | **Sidebar app shell** — grouped left sidebar + top bar + content canvas, replacing the top-banner nav; collapse-to-rail + narrow-screen drawer | slice | High | High | Med | — | Planned — [UX spec](../ux/app-shell-sidebar.md) + [FEAT-UXR1](../features/app-shell-sidebar.md) `Proposed` |
| UXR2 | **Pay-period planner** — promote the S7 surface to first-class (`/pay-periods`, sidebar Planning group) and restore the sheet's at-a-glance planner shape (bills + paycheck ledgers side by side, countdown + balance/reserve figures) | slice | High | Med | Med | UXR1 | Planned — [UX spec](../ux/pay-periods-planner.md) + [FEAT-UXR2](../features/pay-periods-planner.md) `Proposed` |
| UXR3 | **Ledgers tables** — Accounts · Envelopes · Needs-allocation lists → real tables, + the Accounts-page Add-transaction button (UXR1 Q2's additive half) | slice | High | Med | Low | UXR1 (sequence) | Planned — [UX spec](../ux/ledgers-tables.md) `Proposed` |
| UXR4 | **Templates page** — saved-templates list → table; template editor re-organized (**establishes the form-layout pattern**) | slice | Med | Med | Low | UXR1 · UXR8 | Planned — [UX spec](../ux/templates-page.md) `Proposed` (defines the form pattern) |
| UXR5 | **Recurring page** — rule forms onto the form pattern; rules list re-formatted for readability | slice | Med | Med | Low | UXR4 | Planned — [UX spec](../ux/recurring-page.md) `Proposed` (§4 = an owner veto point) |
| UXR6 | **Insights IA** — sub-nav → top tab bar; views grouped (proposal: five category tabs + segmented sub-views) | slice | High | Med | Med | UXR1 · UXR2 | Planned — [UX spec](../ux/insights-ia.md) `Proposed` |
| UXR7 | **Manage page** — Move-money form onto the form pattern | polish | Low | Low | Low | UXR4 | Planned — [FEAT note](../features/manage-move-money.md) `Proposed` |
| UXR8 | **Demo-grade synthetic seed** — rich synthetic dataset so Insights/planner read meaningfully during design/dev | tooling | Med | Low | Low | — | Planned — [FEAT note](../features/demo-seed.md) `Proposed` |

**UXR1 — Sidebar app shell (the layout shift).**
*What:* replace the top-banner shell with the reference chrome — a grouped left sidebar
(**Budget** / **Ledgers** / **Planning** / **Administration**, footer = the global
**Add transaction**; Q1/Q2 resolved 2026-07-06), a top bar (collapse toggle · page title;
compact **+ Add** at ≤ 640px where the sidebar is off-canvas), and the route content as the
canvas. Desktop: sidebar collapses to an icon rail (persisted, client-side). ≤ 640px
(the app's established breakpoint): off-canvas drawer behind a hamburger. The needs-allocation
badge carries over (expanded label pill · rail icon-dot · drawer pill). No route, data, API, or
domain change — the same screens behind new chrome.
*Why:* the owner's stated direction — the app should read like the reference product, and the
sidebar scales to more surfaces than a wrapping link row.
*Detail:* [UX spec — Sidebar app shell](../ux/app-shell-sidebar.md) (`Draft`; the open design
calls are flagged there for owner reaction). Feature spec (FEAT-UXR1) written when the item
goes `Ready`, per the specs-as-gating-work pattern.
*Split option:* if scope proves heavy at `Ready`, the natural seam is **UXR1a** chrome swap
(sidebar + top bar, expanded-only) → **UXR1b** collapse rail + drawer. Decide at spec time.

**UXR2 — Pay-period planner (rework the S7 surface).**
*What:* the shipped S7 pay-periods view carries the right data in the wrong shape for the
owner. Captured 2026-07-06 — what didn't land (owner-confirmed, three of four probes):
**(a) the at-a-glance grid is lost** — the stacked per-check sections scroll section-by-section
where the sheet showed the whole horizon on one screen; **(b) it's buried** as an Insights tab;
**(c) two sheet figures were dropped** — the remaining-to-pay countdown (the sheet's Total
column) and the per-payday projected Balance/Funds ledger. **Explicitly NOT the problem:** the
balanced-latest-fit assignment policy — the FEAT-S7 §5 ratify/veto stays its own open roadmap
decision, untouched by this item.
*The rework:* promote to **`/pay-periods`** (redirect from `/insights/pay-periods`; a
**Pay periods** item in UXR1's Planning group) and re-lay the view as **two side-by-side
ledgers** — bills (bill · due · amount · left-to-pay countdown · covered-by) and paychecks
(payday · income · committed · headroom · projected balance · reserve · status badge) — with
selection-highlight as an *additive* join over the always-present "Covered by" text (the
sheet's color-only blue/red join stays banned, per the S7 spec's own stance). Narrow screens
stack the panes.
*Data note:* the countdown is client-derivable; the per-payday balance/reserve likely means
**additive fields** on `GET /analysis/pay-periods` (same `gatherProjectionInputs` as the
forecast — one gather, reconcilable) — **owner-confirmed 2026-07-06: API-provided**, contract
doc updated in the same change. The countdown shows **both scopes** (a month-scoped column
with subtotal rows — the sheet's Total semantics — plus a 90-day pane figure).
*Detail:* [UX spec — Pay-period planner](../ux/pay-periods-planner.md) (`Draft`; §11 open
questions await owner). Supersedes the presentation of [ux/pay-periods.md](../ux/pay-periods.md)
§3 when it ships; the S7 domain/endpoint/policy are unchanged.

**UXR3 — Ledgers tables (Accounts · Envelopes · Needs allocation).** *(captured 2026-07-07)*
*What:* the three Ledgers-group pages trade their list markup for real tables on the design
system's table treatment — Accounts (name · kind · balance · actions), Envelopes (name · kind ·
balance · the R5 target/spent/remaining · actions), Needs allocation (date · payee · amount ·
account · Allocate). **Presentation only** — every current behavior carries: UX6 progressive
Add, inline rename/archive, R5 inline budget editing, the allocate flow, the nav count badge.
The Accounts page also gains its **page-local Add-transaction button** (the additive half of
[UXR1 §11 Q2](../ux/app-shell-sidebar.md)). *Bar:* real `<th>` semantics; per-row actions keep
accessible names ("Rename <account>"); the UX15 reflow bar holds (`.table-scroll`, no page
scroll at 320px); axe light+dark.

**UXR4 — Templates page.** *(captured 2026-07-07)*
*What:* the saved-templates list gets the same table treatment, and the template editor (name +
multi-row envelope/amount lines) is re-organized onto a clean **form-layout pattern** — label/
field alignment, grouped sections, a consistent action row. This slice **establishes the
pattern** that UXR5 and UXR7 reuse, so it goes before them. *Note:* the owner has no template
data to design against — `UXR8`'s demo seed covers that.

**UXR5 — Recurring page.** *(captured 2026-07-07)*
*What:* the rule create/edit forms adopt the UXR4 pattern; the rules list — currently hard to
read — is re-formatted. *Proposal (spec decides):* a table (payee · amount · cadence · next
date · status/actions) with each rule's carried split as a secondary detail (expandable row or
indented sub-line) rather than inline noise. Post-due flow and generator behavior unchanged.

**UXR6 — Insights IA (top nav).** *(captured 2026-07-07; owner asked for options)*
*What:* replace the wrapping sub-nav with a page-level **top tab bar**. *Direction
(owner-endorsed 2026-07-07):* group the nine views into **five category tabs** — **Spending**
(By envelope · Breakdown · Trends) · **Budget** (vs Actual · Burn-down) · **Cash flow**
(Forecast) · **Debt** (Credit · Payoff) · **Net worth** — multi-view tabs carrying a small
segmented switcher. Every existing `/insights/:view` URL keeps working (tab + segment derive
from the URL; nothing breaks). The flat-tab-row alternative was considered and passed over
(busier at nine tabs). Detailed in the UX spec at `Ready`. *Sequencing:* after `UXR2` (Pay
periods leaves Insights, finalizing the tab set).

**UXR7 — Manage page.** *(captured 2026-07-07)*
*What:* the Move-money form adopts the UXR4 pattern. Small; §11-compressed (FEAT note, no
standalone spec unless scope grows).

**UXR8 — Demo-grade synthetic seed.** *(captured 2026-07-07, from the owner's Insights callout)*
*What:* the owner observed the Insights charts are "masked behind limited data" — a tooling
gap, not a page defect. Extend `npm run seed` (or add `seed:demo`) to generate a **rich,
strictly synthetic** dataset: several months of dated transactions across envelopes, monthly
targets, recurring rules including a paycheck deposit, credit/loan accounts with limits and
principals — so the charts, burn-down, forecast, planner, and the Templates page all *show*
their patterns during design/dev. *Guardrail:* synthetic only, never derived from real figures
(SECURITY.md). *Honest note:* the durable unlock for real-data richness is the deferred
**history import (`#17`/`#18`)** — this item is the cheap dev-time proxy, not a substitute.

## 5. Sequencing

`UXR1` first — every per-page idea renders inside the new chrome, so the shell is the
foundation slice of this initiative (the same reasoning that put UX3/UX4 before the UX-Uplift's
page work). **Numbering is capture order (the owner's dictation), not build order.**
Recommended build order:

```
UXR8 (seed — no gate; cheap; makes everything after honestly evaluable; can even precede UXR1)
UXR1 (shell) ─► UXR2 (planner) ─┬─► UXR3 (Ledgers tables)
                                ├─► UXR4 (Templates + the form pattern) ─► UXR5 (Recurring)
                                │                                        └─► UXR7 (Manage form)
                                └─► UXR6 (Insights IA — after UXR2 finalizes the tab set)
```

## 6. How this maps to the roadmap & artifacts

- **Plan of record:** the roadmap's "UX Redesign" track (`UXR1`+) carries live statuses; this
  brief holds the depth and is linked from that section and §5's log.
- **Per item, as gating work:** a UX spec (`docs/ux/`) before build; a feature spec
  (`docs/features/`) where there's real logic; status report on completion, handoff-ready with
  a kickoff prompt (CLAUDE.md). The Definition of Done — gate-green incl. axe light+dark, docs
  updated in the same change — is unchanged.

> **Status: `Proposed` (draft), capture in progress.** `UXR1` is `Planned` with a `Draft` UX
> spec awaiting owner reaction on the flagged open questions; `UXR2`+ land here as the session
> continues.
