<!--
UX SPEC — UX5: the home budget + future-planning cockpit. Five composed-read panels at `/`, each
deep-linking to its detail route; management stays below (demoted in UX6). Pairs with FEAT-UX5.
-->

# UX Spec — Home: budget + future-planning cockpit

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-UX5 ([feature spec](../features/cockpit.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-07-03                                     |

## 1. User & job

The user opens the app to answer, at a glance: **how is this month's budget going, what's coming up,
is anything waiting on me, and how am I doing overall?** Today the home is a console of management
forms; the spreadsheet they came from *started* with a budget overview. UX5 makes the home that
overview — a forward-looking **cockpit** — while leaving setup reachable below.

## 2. Entry point & navigation

The home route `/` (the shell's **Home** nav link / the **Budgeteer** brand link). The cockpit is the
top region (**Overview**); each panel carries a deep-link to its detail surface, all already routed
(UX3): Budget → `/insights/budget`, Needs → `/needs-allocation`, Upcoming → `/recurring`, Forecast →
`/insights/forecast`, Net worth → `/insights/networth`.

## 3. Primary flow

1. Open `/` → the **Overview** cockpit loads (five panels, fanning out to existing reads).
2. The user reads this-month budget health, what needs allocation, what's coming, the cash-flow
   outlook, and net worth — each a compact card.
3. The user follows a panel's deep-link to act (e.g. **Allocate now** → the needs queue; **Review
   budget** → the Budget view; **Manage recurring** → Recurring).
4. Account/envelope setup remains directly below the cockpit (unchanged) for when the user needs it.

## 4. Screens & states

Each panel handles all four states:

- **Loading** — a `Skeleton` placeholder (polite "Loading…" for assistive tech).
- **Error** — an inline muted note ("Couldn't load this panel."); the rest of the cockpit still
  renders (panels are independent).
- **Empty** — a per-panel `EmptyState`: no monthly targets / everything allocated / no recurring
  transactions / no cash account for a forecast / no accounts to total.
- **Populated** —
  - **This month's budget:** month label + Budgeted / Spent / Remaining (over targeted envelopes, so
    they reconcile) + a badge: **On track** or **N over budget**.
  - **Needs allocation:** the count (large), "N transactions need allocation", Σ unallocated, and
    **Allocate now** (link present only when count > 0).
  - **Upcoming:** a "due to post" badge (when any are due) + a **Still owed this month** figure
    (FEAT-S9: Σ unposted withdrawal occurrences through local month-end — the sheet's D-column
    countdown, derived; a labelled `<dl>` figure, never colour) + the next ≤4 rules (payee · signed
    amount · next date) + **Manage recurring**.
  - **Cash-flow forecast:** "<account> · next N days" + Now / Projected end / Lowest + a badge
    **Stays positive** or **Projected negative on <date>** + **View forecast**.
  - **Net worth:** Assets / Liabilities / Net worth + **Net worth over time**.

## 5. Layout & responsiveness

Desktop-first: an auto-fit card grid (`minmax(15rem, 1fr)`) that flows to multiple columns on a wide
viewport and stacks toward phone width. Cards are the UX4 `Card` primitive; figures are `<dl>`
term/value rows; deep-links are right-of-card text links. No animation in the cockpit itself (the
shell owns the reduced-motion-aware route transition).

## 6. Accessibility

- `<h1>Budgeteer</h1>` retained; the cockpit is a region labelled **Overview** (`<h2>`) of `<h3>`
  panels; one banner, one main. Axe-clean (WCAG 2.2 AA) in light **and** dark.
- Color is never the sole signal — every status is a `Badge` with text. Money is plain labelled text
  (signed, e.g. "-$300.00"), not color-coded (richer visual encoding is `UX13`).

## 7. Out of scope

Management demotion to `/manage` + list routes and progressive add-forms (`UX6`); global quick-add
(`UX7`); within-month budget burn-down viz (`UX11`).
