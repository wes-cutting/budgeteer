<!--
UX SPEC — UX6: demote management off the home. /accounts·/envelopes LIST routes own per-entity CRUD
(progressive Add, name-as-Link), /manage is the cross-cutting hub (net worth + Move-money). Home is
the cockpit only. Pairs with FEAT-UX6.
-->

# UX Spec — Management surfaces (`/accounts` · `/envelopes` · `/manage`)

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Status       | Accepted                                         |
| Feature      | FEAT-UX6 ([feature spec](../features/manage.md)) |
| Owner        | Wesley Cutting                                   |
| Last updated | 2026-06-28                                       |

## 1. User & job

Two distinct jobs were tangled together on the home: *"show me where I stand"* (the cockpit) and
*"let me set things up"* (add/rename/archive accounts and envelopes, move budgeted money, see net
worth). UX6 separates them. The home becomes the cockpit, full stop. **Setup and administration move
to their own surfaces**, reachable from the shell nav — so the landing page stays calm and the
management tools get room to grow.

## 2. Entry points & navigation

The persistent shell nav (UX3) gains three links: **Accounts**, **Envelopes**, **Manage** (between
Insights and Download backup). Each opens a URL-addressable, refresh-safe, deep-linkable route:

- **Accounts** → `/accounts` — your accounts; click one to open its register (`/accounts/:id`).
- **Envelopes** → `/envelopes` — your envelopes; click one to open its ledger (`/envelopes/:id`).
- **Manage** → `/manage` — net worth + Move-money, with links to the two list pages.

The cockpit's deep-links (UX5) are unchanged. Account/envelope **names are now `<Link>`s** (UX3 left
them as buttons), so middle-click / open-in-new-tab work.

## 3. Screens & states

### `/accounts`
- **Heading** `Accounts`.
- **Add** — a single **"Add account"** button (progressive). Activating it reveals the create form
  (Name · Kind · Starting balance) plus a **Cancel**; a successful add collapses it and the new
  account appears in the list.
- **List** (`Accounts list`) — each row: the **name as a link** · kind · balance · **Rename** ·
  **Archive**. Rename swaps the name for an inline input + **Save**.
- **Archived** — a **Show archived / Hide archived** toggle (present only when archived accounts
  exist) reveals an `Archived accounts` section with **Unarchive** per row.
- **Empty** — "No accounts yet — add the bank, card, or cash accounts you use." **Loading** — "Loading…".
  **Error** — a `role="alert"` line.

### `/envelopes`
- **Heading** `Envelopes`. **Add** — a progressive **"Add envelope"** button → form (Name · Kind) +
  Cancel.
- **List** (`Envelopes list`) — each row: the **name as a link** · kind · balance · the **R5 inline
  budget** (`Target · Spent · Remaining`, shown only when a monthly target is set; remaining keeps its
  sign) · **Archive**. An `Archived` section lists archived envelopes with **Unarchive**.
- **Empty / loading / error** mirror `/accounts`.

### `/manage`
- **Heading** `Manage`, a one-line intro `<p>`, then a **Management** nav listing **Accounts** and
  **Envelopes** (each link alone in its item — never embedded in prose).
- **Net worth** (`<h2>`) — the labelled `Net worth summary` table (Total assets · Total liabilities ·
  Net worth); before any account exists, a prompt replaces it.
- **Move money** (`<h2>`) — the **Move money between envelopes** form (From · To · Amount · Memo);
  rendered only when ≥2 active envelopes exist. Reallocated balances show on `/envelopes`.

## 4. Accessibility

- One `<main>` + one `<h1>` per route; the shell owns the single banner/nav. Heading order h1 → h2.
- **List items are links** whose accessible name is the entity name; surrounding kind/balance/buttons
  are sibling elements, so they don't trip `link-in-text-block`. The `/manage` hub links stand alone
  in their `<li>` for the same reason.
- Color is never the only signal (text buttons; labelled table; signed inline budget text).
- No opacity animation on any text wrapper (the shell's transform slide is the only motion; honored
  only without `prefers-reduced-motion`).
- Axe-clean (WCAG 2.2 AA) in **light and dark** on all three surfaces (`e2e/a11y.spec.ts`).

## 5. Out of scope

Confirm-on-destructive for Archive (`UX12`) · budget-health visual encoding (`UX13`) · first-run
onboarding that walks "add an account, add envelopes" (`UX14`) · responsive/phone pass (`UX15`) ·
global quick-add transaction (`UX7`).
