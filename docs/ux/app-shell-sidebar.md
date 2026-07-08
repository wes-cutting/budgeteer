<!--
UX SPEC — UXR1: the sidebar app shell (the 2026-07-06 UX-redesign layout shift). Replaces the
top-banner chrome from UX3 with the reference layout: grouped left sidebar + top bar + content
canvas. Pairs with FEAT-UXR1 (written at Ready). Initiative brief:
reviews/2026-07-06-ux-redesign-initiative.md. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# UX Spec — Sidebar app shell (layout shift)

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Status       | **Proposed** — every §11 design question owner-resolved 2026-07-06         |
| Feature      | [FEAT-UXR1](../features/app-shell-sidebar.md) (`Proposed`)                 |
| Owner        | Wesley Cutting                                                             |
| Last updated | 2026-07-07                                                                 |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · supersedes the chrome of [FEAT-UX3](../features/app-shell.md) · reference screenshot (2026-07-06 session; save to `assets/2026-07-06-dashboard-reference.png`) |

## 1. User & job

The shell is every screen's frame. The user needs to always know **where they are**, reach
**any surface in one click**, and fire the daily action (**Add transaction**) from anywhere —
in a frame that reads like a finished product (the reference layout) rather than a link row,
and that scales as the redesign adds surfaces.

## 2. Entry points & navigation

The shell wraps every route (persistent root layout, unchanged from UX3). **No route changes**
— the same URLs behind new chrome. The flat nav row becomes grouped sidebar sections:

| Group *(Q1 resolved 2026-07-06)* | Items (route) |
| -------------------------------- | ------------- |
| **Budget**    | Home (`/`) · Insights (`/insights`) |
| **Ledgers**   | Accounts (`/accounts`) · Envelopes (`/envelopes`) · Needs allocation (`/needs-allocation`, count badge) |
| **Planning**  | Templates (`/templates`) · Recurring (`/recurring`) · Pay periods (`/pay-periods`, UXR2 — until it ships, the item deep-links to `/insights/pay-periods`) |
| **Administration** | Manage (`/manage`) · Download backup (`GET /export` link) |

- **Brand** ("Budgeteer") tops the sidebar and links to `/` (unchanged).
- **Add transaction** (`/transactions/new`, the UX7 modal route) lives in the **sidebar
  footer** as the nav's primary action (Q2 resolved 2026-07-06) — full button when expanded /
  in the drawer, icon-only in the rail. At ≤ 640px the sidebar is off-canvas, so the **top bar
  carries a compact + Add** — the action stays one interaction away in every mode (the UX7
  bar, preserved). A second, page-local button atop the **Accounts page** is the additive half
  of Q2 — it lands with **UXR3** (Ledgers tables).
- Detail routes (`/accounts/:id`, `/envelopes/:id`, `/insights/:view`) highlight their parent
  item (path-prefix match — e.g. an account register lights **Accounts**).
- **Sidebar footer** (Q1 + Q2): holds **Add transaction** only. Download backup files under
  Administration; the reference's footer content (changelog · help · docs) has no Budgeteer
  analog.

## 3. Primary flow

1. User opens any route → sidebar (left) + top bar + the page as content canvas; the active
   item is marked in the sidebar; the top bar names the page.
2. User clicks a sidebar item → route renders in the canvas; sidebar and top bar persist
   (no remount); active marker + top-bar title update.
3. User clicks the top-bar toggle → sidebar collapses to an **icon rail**; labels hide, icons +
   badge remain; the choice **persists** across reload (client-side only). Toggle again →
   expanded.
4. At ≤ 640px the sidebar is off-canvas: the toggle becomes a **hamburger** that opens the
   sidebar as a **drawer** over the content; choosing an item (or Esc / scrim click) closes it
   and focus returns to the hamburger.
5. **Add transaction** in the sidebar footer (compact top-bar **+ Add** at ≤ 640px) opens the
   existing quick-add modal from anywhere (UX7 behavior unchanged).

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Sidebar (expanded) | Primary navigation | Brand · grouped items (icon + label) · needs-allocation count pill · **Add transaction** footer (primary action) |
| Sidebar (rail) | Same nav, minimal width | Icons only (~56–64px); accessible names + tooltips; badge becomes an icon count-dot; footer add button icon-only |
| Sidebar (drawer, ≤ 640px) | Nav on narrow screens | The expanded sidebar as a modal drawer: focus trapped, Esc/scrim closes, focus restored |
| Top bar | Orientation | Toggle/hamburger (`aria-expanded`) · current page title · compact **+ Add** at ≤ 640px only (the footer is off-canvas there) |
| Content canvas | The route | Unchanged this slice — pages keep their own internals and max-width (§10) |

Shell states (the shell is chrome — its "data states" are the badge and the layout mode):

- **Badge loading/error** — carried from UX3: refetched per path change; a failed fetch leaves
  the badge **absent** (auxiliary — never breaks the chrome).
- **Badge populated** — count > 0: pill beside the label (expanded/drawer) or count-dot on the
  icon (rail); the count always lives in the link's `aria-label`.
- **Layout modes** — expanded (default ≥ 640px) · rail (persisted user choice) · drawer
  open/closed (≤ 640px; never persisted open).
- **Active route** — accent edge-bar + weight + `aria-current="page"` (shape + weight, never
  color alone).
- **Empty / permission-limited** — n/a (nav is static; single-user V1).

## 5. Wireframe / layout

Expanded (default, > 640px):

```
+----------------+------------------------------------------------------------+
| ◆ Budgeteer    | [«]  Home                                                    |
|                +------------------------------------------------------------+
| BUDGET         |                                                            |
| ▸ ⌂ Home       |   (route content — the canvas; page internals unchanged    |
|   ◔ Insights   |    by this slice)                                          |
|                |                                                            |
| LEDGERS        |                                                            |
|   ▤ Accounts   |                                                            |
|   ✉ Envelopes  |                                                            |
|   ◫ Needs  (3) |                                                            |
|                |                                                            |
| PLANNING       |                                                            |
|   ▦ Templates  |                                                            |
|   ↻ Recurring  |                                                            |
|   ⇄ Pay periods|                                                            |
|                |                                                            |
| ADMINISTRATION |                                                            |
|   ⚙ Manage     |                                                            |
|   ⤓ Download   |                                                            |
|                |                                                            |
| [ + Add txn ]  |                                                            |
+----------------+------------------------------------------------------------+
  ▸ = active-item accent edge-bar (+ weight + aria-current)
  [ + Add txn ]  = the Q2 footer — the nav's primary action (full label: "Add transaction")
```

Collapsed rail (user toggle, persisted):

```
+----+--------------------------------------------------------------+
| ◆  | [»]  Accounts                                                |
|    +--------------------------------------------------------------+
| ⌂  |                                                              |
| ◔  |   (canvas)                                                   |
| ▤  |                                                              |
| ✉  |   ³ = needs-allocation count-dot; name + count stay in the   |
| ◫³ |       link's aria-label; tooltip on hover/focus              |
| …  |                                                              |
| ⊕  |   footer: icon-only Add transaction (accessible name kept)  |
+----+--------------------------------------------------------------+
```

Drawer (≤ 640px — hamburger in the top bar; drawer overlays with a scrim):

```
+------------------------------------+        +----------------+---------------+
| [≡]  Home        [ + Add txn ]     |  --->  | ◆ Budgeteer  ✕ | ░░░░░░░░░░░░░ |
+------------------------------------+        | BUDGET         | ░░ (scrim) ░░ |
| (canvas, full width)               |        | ▸ ⌂ Home       | ░░░░░░░░░░░░░ |
|                                    |        |   ◔ Insights   | ░░░░░░░░░░░░░ |
+------------------------------------+        |   … groups …   | ░░░░░░░░░░░░░ |
                                              | [ + Add txn ]  | ░░░░░░░░░░░░░ |
                                              +----------------+---------------+
  The narrow top bar keeps a compact [ + Add txn ] — the footer is off-canvas until the
  drawer opens, and the daily action must stay one interaction away (UX7).
```

## 6. Interactions & inputs

- **Toggle (≥ 640px):** a real `<button>` with `aria-expanded` + accessible name
  ("Collapse sidebar" / "Expand sidebar"); flips expanded ↔ rail; persists client-side
  (e.g. `localStorage` — UI state only, never API state). Rail/expand transition is a width
  transform gated by `prefers-reduced-motion`.
- **Hamburger (≤ 640px):** same button, name "Open navigation"; opens the drawer — focus moves
  into it, **Tab is trapped, Esc and scrim-click close, focus restores** to the hamburger
  (ride the proven `Dialog` focus machinery, not hand-rolled). Navigating closes the drawer.
- **Rail items:** icon-only but each link keeps its full accessible name; a visible tooltip on
  hover **and keyboard focus** (never hover-only).
- **Add transaction:** unchanged UX7 modal route. Home = the sidebar footer (full button
  expanded/drawer, icon-only in the rail); at ≤ 640px the top bar carries the compact
  **+ Add** so the action never hides behind the hamburger.
- **Keyboard:** all items tabbable in reading order (groups top-to-bottom); visible focus ring
  (existing token); ≥ 24px targets everywhere (WCAG 2.5.8), including rail icons.
- **Edge inputs:** badge count ≥ 100 renders "99+" (aria-label keeps the exact count); long
  page titles truncate with ellipsis + `title`.

## 7. Content & copy

- Group labels: **Budget · Ledgers · Planning · Administration** (Q1 resolved 2026-07-06).
- Item labels: Home · Needs allocation · Insights · Accounts · Envelopes · Templates ·
  Recurring · **Pay periods** (UXR2) · Manage · Download backup · **Add transaction**.
- Button names: "Collapse sidebar" / "Expand sidebar" / "Open navigation" / "Close navigation".
- Top-bar titles = the existing page names (Home · Accounts · *account name* · Envelopes ·
  *envelope name* · Needs allocation · Templates · Recurring · Insights · Manage) — rendered
  as the page's `<h1>` (§11 Q3); dynamic names fall back to the kind label ("Account" /
  "Envelope") until the view's data resolves.
- Document title follows the page: **"\<Page title\> — Budgeteer"** (deep links and browser
  history get honest names).

## 8. Accessibility

Baseline **WCAG 2.2 AA**, axe-clean **light AND dark** (the existing gate):

- Sidebar is one `<nav aria-label="Primary">`; groups are labeled lists (`aria-labelledby` a
  visible group heading) — **not** multiple nav landmarks. One banner (top bar), one main.
- Active item: accent edge-bar + weight + `aria-current="page"` — never color alone.
- Toggle/hamburger: real buttons, `aria-expanded`, accessible names (§7).
- Drawer: modal semantics (focus trap, Esc, restore) per the `Dialog` precedent; scrim click
  closes.
- Rail: accessible names intact; tooltips on focus as well as hover; count-dot is decorative
  (`aria-hidden`) with the count in the `aria-label` (the UX3/R2 convention, carried).
- **Heading integrity (Q3 resolved):** the **shell owns the `<h1>`** — the top-bar title *is*
  the page's single `<h1>`; views drop theirs and their content headings start at `<h2>`.
  Exactly one `<h1>` in every state (expanded · rail · drawer open); the axe suite (light +
  dark) stays green throughout the migration.
- All motion (rail transition, drawer slide) gated by `prefers-reduced-motion`; no horizontal
  page scroll at 320px (the UX15 reflow bar, now including the drawer).

## 9. Acceptance criteria (UX)

- **Given** any route, **when** the page loads, **then** the sidebar marks the active item
  (edge-bar + weight + `aria-current`) and the top bar names the page.
- **Given** the toggle is clicked, **then** the sidebar collapses to the rail (labels hidden,
  accessible names intact) **and** the mode survives a reload.
- **Given** ≤ 640px, **when** the hamburger is clicked, **then** the drawer opens with focus
  inside, Esc/scrim/navigation closes it, and focus returns to the hamburger.
- **Given** transactions need allocation, **then** the count is visible in every mode
  (pill / count-dot) and present in the link's `aria-label`; a failed badge fetch leaves the
  chrome intact.
- **Given** any sidebar state (expanded · rail · drawer open), the axe scan passes light AND
  dark, and at 320px there is no horizontal page scroll.
- Every route stays URL-addressable with back/forward/refresh intact (the UX3 bar, re-verified
  through the new chrome); `e2e/setup.ts` nav helpers re-pointed.
- **Add transaction** opens the quick-add modal from every route in every mode.

## 10. Out of scope / later

- **Per-page redesigns** (cockpit grid, Insights layouts, tables/cards) — captured separately
  as `UXR2`+ in the [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md).
- **Canvas width:** pages keep their own `main` max-width this slice; relaxing to the
  reference's full-width composition happens per page with its redesign item.
- **Notifications, user/avatar menu, share** — no analog (single-user, no-auth; deferred
  `#19`). The top bar leaves room; nothing is built.
- **Theme changes** — the token sheet already does light + dark; the reference's dark look is
  the existing dark theme. Any palette tuning is its own later item.

## 11. Open questions (owner) — all resolved 2026-07-06

| # | Question | Lean |
| - | -------- | ---- |
| Q1 | **Nav grouping & labels** — is Budget / Money / Planning / Administration the right cut? (Alternatives: fold Needs allocation into **Money**; name Planning **Automation**.) | **Resolved 2026-07-06 (owner), amending the proposal:** **Budget** (Home · Insights) · **Ledgers** (Accounts · Envelopes · **Needs allocation**, filed with the ledgers rather than the daily loop) · **Planning** (Templates · Recurring · Pay periods) · **Administration** (Manage · **Download backup**). Money renamed **Ledgers**; Download backup leaves the footer → **no sidebar footer in V1** (§2). |
| Q2 | **Add transaction placement** — top bar right (as specced) or a Gmail-style primary button atop the sidebar? | **Resolved 2026-07-06 (owner): additive.** The always-visible entry is the **sidebar footer** (the slot Q1 emptied): full primary button expanded/in-drawer, icon-only in the rail; at ≤ 640px the top bar carries a compact **+ Add** (the footer is off-canvas there — preserves UX7's from-anywhere bar). Plus a page-local button atop the **Accounts page**, landing with **UXR3** (Ledgers tables). The global affordance (UX7) is explicitly preserved. |
| Q3 | **Who owns the `<h1>`** — (a) shell renders it in the top bar via route-handle titles and every view drops its own (clean, but touches every view + suites); (b) top-bar title is secondary text and views keep their `<h1>` (cheap; page name appears twice); (c) no top-bar title (cheapest; diverges from the reference). | **Resolved 2026-07-06 (owner): (a) — the shell owns the `<h1>`.** Mechanism: static routes title via route `handle`; **dynamic routes (account register · envelope ledger) publish their resolved name through a shell title context** (kind-label fallback — "Account" / "Envelope" — until their data arrives; the views fetch, so the router can't know the name); `document.title` syncs (§7); the quick-add modal route never retitles the page (its `Dialog` names itself). Views drop their `<h1>`s; content headings start at `<h2>` (Insights keeps "Insights" as the `<h1>`, the active tab becomes an `<h2>`). Blast radius accepted into this slice: every view + its heading assertions (unit + e2e), re-pointed once. Formalized in FEAT-UXR1. |
| Q4 | **Icons** — hand-rolled inline SVGs (~10 needed; matches the ADR-0007 hand-rolled stance) or an icon dependency? | **Resolved 2026-07-06 (owner): the middle path** — copy the needed ~10 SVG paths from a permissively-licensed professional set (**lucide, ISC license**) into repo-owned components: professional drawings, **zero dependency**, attribution comment + license text kept alongside. (The budget half was already resolved — 120 → 140 KB gz re-baseline, [`07_NFR` §1³](../07_NFR.md).) |
| Q5 | **Split the slice?** UXR1a (chrome swap, expanded-only) then UXR1b (rail + drawer)? | **Resolved 2026-07-06 (owner): keep UXR1 whole** — the larger slice is accepted; no UXR1a/1b split (shipping chrome without the drawer would leave ≤ 640px worse than today's wrapping nav). |
