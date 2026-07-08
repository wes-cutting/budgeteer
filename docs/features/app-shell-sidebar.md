<!--
FEATURE SPEC — scopes roadmap item UXR1 (2026-07-06 UX Redesign). The build/mechanism/test
side of the sidebar shell; the look and behavior live in the paired UX spec
(docs/ux/app-shell-sidebar.md, Proposed — every design question owner-resolved).
Supersedes the chrome of FEAT-UX3 (docs/features/app-shell.md); routing (ADR-0006) unchanged.
-->

# Feature Spec — Sidebar app shell (the layout shift)

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Feature ID   | FEAT-UXR1                                                               |
| Status       | Proposed — awaiting owner nod → `Ready`                                 |
| Owner        | Wesley Cutting                                                          |
| Last updated | 2026-07-07                                                              |
| Related      | [UX spec](../ux/app-shell-sidebar.md) (`Proposed`) · [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · supersedes the chrome of [FEAT-UX3](app-shell.md) · [`ADR-0006`](../adr/ADR-0006-client-routing.md) (unchanged) |

## 1. Summary

Replace the UX3 top-banner chrome with the reference layout: a grouped left **sidebar**
(Budget · Ledgers · Planning · Administration; footer = the global **Add transaction**), a
**top bar** (collapse toggle · the page's `<h1>` title · compact **+ Add** at ≤ 640px), and the
route content as the canvas. **No route, data, API, or domain change** — the same screens
behind new chrome. Every design decision is already owner-resolved (UX spec §11); this spec
fixes the mechanism, blast radius, and tests.

## 2. Mechanism

### 2.1 Shell composition (`AppShell.tsx` / `AppShell.module.css` — rewrite)

- Layout: a two-region shell — `<nav aria-label="Primary">` sidebar + a main column
  (`<header>` top bar above the keyed route `<Outlet>` wrapper). One banner, one nav
  landmark, one `<main>` per page (unchanged invariants).
- Sidebar: brand link → `/`; four groups, each a visible group heading + a list
  (`aria-labelledby` the heading — **not** nested nav landmarks); items per the UX spec §2;
  footer **Add transaction** `<Link>` (primary-action styling, the UX7 route).
- Active item: accent edge-bar + weight + `aria-current="page"`; detail routes highlight
  their parent by path-prefix match (`/accounts/:id` → Accounts).
- Needs-allocation badge: logic carried verbatim from UX3 (refetch per path change; failure →
  badge absent); rendered as label pill (expanded/drawer) or icon count-dot (rail), count
  always in the link's `aria-label`.

### 2.2 Page-title mechanism (the resolved Q3)

- `routes.tsx`: each static route gains `handle: { title: "…" }`; the shell reads the deepest
  match via `useMatches()` and renders the title as the page's **single `<h1>`** in the top
  bar.
- Dynamic routes (account register · envelope ledger): a `PageTitleContext` provided by the
  shell exposes `useSetPageTitle(name)`; the route adapter/view publishes the resolved name
  when its data arrives; until then the handle's kind label ("Account" / "Envelope") shows.
- `document.title = "<title> — Budgeteer"`, updated on title change.
- The quick-add modal route has **no** title handle — it never retitles the page (its `Dialog`
  names itself).
- **Every view drops its own `<h1>`**; the view's top content heading becomes `<h2>` (existing
  sub-structure keeps relative order). Insights keeps "Insights" as the shell title; the
  active tab heading demotes to `<h2>`.

### 2.3 Collapse / drawer

- ≥ 640px: `expanded ↔ rail`, toggled by a real `<button>` (`aria-expanded`, names per UX
  spec §7); persisted under one localStorage key (e.g. `budgeteer.sidebar = "expanded" |
  "rail"`), read once on mount. **Client UI state only — never API state.**
- ≤ 640px (the app's established breakpoint): the sidebar is an off-canvas **drawer** on the
  existing **Radix `Dialog`** machinery (focus trap, Esc, restore — no hand-rolled focus
  code), styled as a side sheet with a scrim; navigating closes it. The top bar swaps the
  toggle for the hamburger and gains the compact **+ Add**.
- All transitions gated by `prefers-reduced-motion`; the route slide-in carries unchanged.

### 2.4 Icons (the resolved Q4)

- New `ui/icons.tsx`: ~12 inline-SVG components (nav items ×9 · brand · toggle/hamburger ·
  close), **paths copied from lucide (ISC)** — professional drawings, **zero dependency**.
  File header carries the attribution + the ISC license text. Icons render `aria-hidden`
  (accessible names live on the links/buttons), sized `1em`/`currentColor` off the tokens.

## 3. Blast radius (accepted at capture — owner-resolved Q3/Q5)

| Surface | Change |
| ------- | ------ |
| `AppShell.tsx` / `.module.css` | Rewritten (sidebar + top bar + drawer + persistence) |
| `routes.tsx` | Title handles; no route/path changes |
| Every routed view (~16 files) | Drop `<h1>`, demote top heading to `<h2>`; register/ledger publish their resolved name |
| `ui/icons.tsx` (new) | The copied-path icon set |
| Unit tests | Heading assertions re-pointed (`h1` → shell; views assert `h2`); new title-context + persistence + badge-mode tests |
| `e2e/setup.ts` + specs | Nav helpers re-pointed to the sidebar; `a11y.spec.ts` gains rail + drawer scans (light AND dark); reflow spec keeps 320px green |

## 4. Testing

- **Unit:** title fallback → resolved-name flow; `document.title` sync; collapse persistence
  (set → reload state); badge pill/dot modes incl. fetch-failure absence; group/aria structure.
- **e2e:** navigate every route via the sidebar (helpers); toggle → rail → reload persists;
  drawer open/Esc/scrim/navigate-closes with focus restored to the hamburger; quick-add opens
  from footer (wide) and top-bar + Add (narrow); exactly one `<h1>` per page; axe light + dark
  in expanded/rail/drawer; 320px no-horizontal-scroll.
- Gate green (typecheck · lint · format · unit · e2e incl. a11y · build · SCA), per the DoD.

## 5. Non-goals

Canvas/page-width changes (per-page items) · page internals (UXR3–UXR7) · notifications/user
menu (deferred `#19`; the top bar leaves room) · theme/palette changes · any data/API change.

## 6. Acceptance

The UX spec §9 criteria, plus: bundle delta recorded in `07_NFR` §1³ against the **140 KB gz**
budget (expected ≈ +2–4 KB); docs updated in the same change (this spec → `Implemented`,
FEAT-UX3 marked superseded-by-UXR1 for the chrome, status report with test-count delta).
