<!--
FEATURE SPEC — scopes roadmap item UX3 (2026-06-25 UX Uplift). Build as a vertical slice:
React Router (data router) + a persistent app shell, retiring the hand-rolled `view` state
machine. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Routing + persistent app shell

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX3                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-27-ux3.md)) — **the chrome is superseded by [FEAT-UXR1](app-shell-sidebar.md)** (the sidebar shell, 2026-07-07); the **route map + routing mechanism (ADR-0006) below stand unchanged** |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-07                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX3`) · [`ADR-0006`](../adr/ADR-0006-client-routing.md) · [`SPIKE-06`](../spikes/06-design-system-routing.md) · builds on [FEAT-UX4](design-system.md) · **chrome superseded by [FEAT-UXR1](app-shell-sidebar.md)** |

## 1. Summary

The web app's navigation runs on **React Router 7 (data router)** behind a **persistent app shell**,
per [`ADR-0006`](../adr/ADR-0006-client-routing.md), replacing the hand-rolled `view` state machine
in `App.tsx`. Every screen is now **URL-addressable, deep-linkable, refresh-safe**, and the browser
**back/forward** buttons work. The per-screen "← Dashboard" buttons are gone; navigation lives in
the shell's persistent primary nav. The shell is built on the UX4 token sheet.

This is the routing/shell slice only. Restyling each screen's internals (UX4, done) and reframing
the home into a cockpit (UX5) are **out of scope**.

## 2. Route map

The shell is a persistent root layout (`AppShell`) with the primary nav + a route `<Outlet>`.

The table below is the route map **as of UX7** (the `/` home, the demoted list/hub routes, the
quick-add modal route, and the nav reflect UX5 + UX6 + UX7; see [FEAT-UX5](cockpit.md) /
[FEAT-UX6](manage.md) / [FEAT-UX7](quick-add-transaction.md)).

| URL | Screen | Notes |
| --- | ------ | ----- |
| `/` | Home (cockpit) | UX5 cockpit **only** since UX6 (management demoted) — [FEAT-UX6](manage.md) |
| `/transactions/new` | Quick-add transaction (modal) | UX7 — global add-a-transaction dialog over whatever you were on; returns you there on save/dismiss — [FEAT-UX7](quick-add-transaction.md) |
| `/accounts` | Accounts list | UX6 — progressive Add + names as `<Link>`s + rename/archive |
| `/accounts/:id` | Account register | name re-derived from the account list → refresh-safe |
| `/envelopes` | Envelopes list | UX6 — progressive Add + names as `<Link>`s + R5 inline budget + archive |
| `/envelopes/:id` | Envelope ledger | `EnvelopeLedgerRoute` resolves the id against the envelope list → refresh-safe |
| `/manage` | Manage hub | UX6 — net-worth summary + Move-money + links to the list pages |
| `/needs-allocation` | Needs-allocation queue | the count badge lives in the shell nav (R2) |
| `/templates` | Templates | |
| `/recurring` | Recurring | |
| `/insights` | → redirect → `/insights/spend` | the Insights hub default |
| `/insights/:view` | Analysis views | `view ∈ {spend, budget, forecast, credit, payoff, networth}`; sub-nav is `NavLink`s; unknown view → `spend` |
| `*` | → redirect → `/` | catch-all |

**As shipped by UX3** the `/` home was the Dashboard (accounts + envelopes + management) and
account/envelope list items navigated **programmatically** (the Dashboard's `onOpen*` callbacks →
`navigate(...)`), with `/manage` + the `/accounts`·/envelopes list routes deferred. **`UX6` has since
landed** those routes and turned the list items into `<Link>`s (the home is now the cockpit only).
**`UX7` has since landed** the `/transactions/new` quick-add **modal** route (a `Dialog`-primitive
overlay) + an always-available **Add transaction** entry in the shell nav — see
[FEAT-UX7](quick-add-transaction.md).

## 3. Shell composition

> **Superseded by [FEAT-UXR1](app-shell-sidebar.md) (2026-07-07).** The top-banner chrome below was
> replaced by the grouped sidebar shell (sidebar + top bar + drawer; the shell now owns the page
> `<h1>`). The `api-context.tsx` provider and the `routes.tsx` adapter pattern are unchanged.

- `AppShell.tsx` / `AppShell.module.css` — a banner (`<header>`) with a brand link + a
  `<nav aria-label="Primary">` of an **Add transaction** action `<Link>` (the `UX7` global quick-add,
  styled as the nav's primary action) followed by `NavLink`s (Home · Accounts · Envelopes · Needs
  allocation · Templates · Recurring · Insights · Manage — Accounts/Envelopes/Manage added in `UX6`) +
  a Download-backup link, and the keyed route `<Outlet>`. Active links are marked by
  weight + underline **and** `aria-current="page"` (never colour alone). The **needs-allocation
  count badge** (moved from the Dashboard) is refetched on each path change, so completing an
  allocation and navigating refreshes it; the fetch is auxiliary (a failure leaves the badge absent).
- `api-context.tsx` — the single `Api` is provided above `RouterProvider` so route adapters reach
  it via `useApi()`; the view components still take `api` as a prop (so their unit tests render them
  directly).
- `routes.tsx` — `createAppRouter()` + thin route adapters (read `useApi()`/`useParams()`, render
  the unchanged view).

## 4. Motion / a11y

- **Reduced-motion-aware transition:** a subtle route slide-in (`transform: translateY`, 140 ms) on
  the keyed content wrapper, gated by `@media (prefers-reduced-motion: no-preference)` (and the base
  layer's global reduce rule). It is a **transform, not an opacity fade** — a mid-flight opacity < 1
  blends descendant text toward the background and trips the axe contrast gate on muted text; a
  transform never changes computed colour.
- **Headings/landmarks preserved:** the brand is a link (not a heading), so each route keeps exactly
  one `<h1>`; one banner + one main per page. The axe suite (light + dark) stays green.

## 5. Acceptance criteria

- ✅ Every existing screen reachable by URL; deep-link + refresh re-render it; back/forward work
  (`e2e/routing.spec.ts`).
- ✅ The per-screen "← Dashboard" buttons are gone; navigation is the persistent shell nav.
- ✅ e2e specs re-pointed to navigate via the shell (`e2e/setup.ts` helpers + per-spec updates).
- ✅ a11y green (light + dark); every screen keeps its `h1`/aria.
- ✅ No data/API/domain change.

## 6. Out of scope (later slices)

`/manage` + management demotion + list routes (`UX6`, done) · quick-add modal route (`UX7`, done) ·
the cockpit home (`UX5`, done) · Analysis → Insights rename + charts (`UX8`).
