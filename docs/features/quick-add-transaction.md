---
type: feature-spec
roadmap-item: BUD-S52
status: Implemented
---
<!--
FEATURE SPEC — scopes roadmap item UX7 (2026-06-25 UX Uplift). Build as a vertical slice: an
always-available global "add a transaction" entry, mounted as an accessible modal route that
reuses the existing allocation editor. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Global quick-add transaction

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX7                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-28-ux7.md))    |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-06-28                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX7`) · [UX spec](../ux/quick-add-transaction.md) · builds on [FEAT-UX3](app-shell.md) (router/shell) · [FEAT-UX4](design-system.md) (`Dialog` grown here) · [FEAT-UX5](cockpit.md) · [FEAT-UX6](manage.md) · reuses [transactions](transactions.md) (editor) · [`ADR-0005`](../adr/ADR-0005-frontend-design-system.md) (Radix for Dialog) · [`ADR-0006`](../adr/ADR-0006-client-routing.md) |

## 1. Summary

PRD **journey #1 — the common case** (record a transaction and split it across envelopes) was
**buried behind opening an account register**: you had to know the account, navigate to it, and use
the register's in-page form. `UX7` adds an **always-available global entry**: an **Add transaction**
action in the persistent shell nav opens a **modal route** at `/transactions/new` that lets you
**pick the account**, enter amount/payee, and allocate in **Single** or **Split** — then **returns you
to where you were**.

It is a **thin composition slice**: it **reuses the register's editor stack unchanged**
(`AddTransactionForm` → `AllocationEditor`) and **fans out to the existing
`createTransaction` / `setAllocations` endpoints** — **no new endpoint, no schema/API/domain change**.
The only genuinely new thing the global entry needs (that the register doesn't) is **choosing which
account** to post to; everything else is the same editor the register composes.

The modal is the new **`Dialog` primitive** (Radix, per `ADR-0005`) — the first genuine modal in the
app, so `UX7` is where the deferred `Dialog` of `UX4`'s seed-and-grow lands.

## 2. Scope

- **In scope**
  - **`Add transaction` entry** in the persistent shell nav (always available; styled as the nav's
    primary action). *(The cockpit's Needs-allocation panel is an explicitly-allowed alternative home
    per the brief's "and/or"; shell-nav-only chosen — see §11.)*
  - **Modal route** `/transactions/new` — a child of the shell that overlays wherever you were and,
    on save **or** dismiss (ESC / overlay click / × / Cancel), **navigates back** (history-safe: a
    direct deep-link with no back-entry falls back to `/`).
  - **Account picker** — `AddTransactionForm` gains an optional account-picker mode (a labelled
    `<select>` of active accounts); Save is held until an account is chosen.
  - **Reuse** the existing editor (Single/Split, refunds, templates, partial allocation) verbatim.
  - **`Dialog` primitive** (`apps/web/src/ui/Dialog.tsx`, Radix) — `role="dialog"` + accessible name,
    focus trap, ESC/overlay close, **focus-restore** to the trigger; axe-clean **light and dark**.
- **Out of scope**
  - A new "create transaction" endpoint or any API/domain/schema change (fan-out only).
  - Editing/allocating existing transactions (that is the register + Needs-allocation, unchanged).
  - Transfers / envelope reallocations / recurring (separate flows; the modal is single-account entry).
  - Charts / Insights (`UX8`).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As a user, I can add a transaction from anywhere in one click, without first opening the right account. | Must |
| US-2 | As a user, I pick the account in the modal, enter the amount/payee, and allocate Single or Split — the same editor I already know. | Must |
| US-3 | As a user, a partial allocation is allowed; the unallocated remainder still shows up in Needs allocation. | Must |
| US-4 | As a user, saving (or dismissing) returns me to exactly where I was. | Must |
| US-5 | As a keyboard / screen-reader user, the modal traps focus, closes on `Esc`, restores focus on close, and is announced as a dialog. | Must |

## 4. Acceptance criteria

- **Given** any screen, **then** the shell nav shows an **Add transaction** entry; activating it opens
  the `/transactions/new` modal over the current page.
- **Given** the modal, **when** I pick an account, enter an amount, and allocate (Single or Split),
  **then** Save fans out to `createTransaction` against the **chosen** account and I am returned to
  where I was.
- **Given** Save, **when** no account is chosen, **then** Save is disabled (the editor's existing
  amount/allocation gates still apply).
- **Given** a partial allocation, **when** saved, **then** the remainder reconciles to the ledger and
  surfaces in **Needs allocation** (the same `unallocatedCents` path the register uses — no forced
  full split).
- **Given** the modal, **then** it is a `role="dialog"` with an accessible name, traps focus, closes
  on `Esc` / overlay click / ×, and restores focus to the trigger; the **axe suite is green in light
  AND dark**.
- **Given** the gate, **then** typecheck · lint · format · unit · e2e (incl. a11y light+dark) · build
  all pass; the bundle stays **< 120 KB gz** (105.4 KB after Radix dialog).
- **No** data/API/domain change; **no** new endpoint.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| No accounts yet | the modal shows a "add an account first" message with a `<Link>` to `/accounts` — never a dead form |
| Accounts/envelopes read fails | an `Alert` (`role="alert"`) inside the modal, not a blank dialog |
| Archived accounts | excluded from the picker (only active accounts can take a new transaction) |
| Partial / zero allocation | allowed; Save enabled once amount + account are valid; remainder → Needs allocation |
| Over-allocation / refunds-exceed | the editor's existing guards disable Save (unchanged) |
| Direct deep-link to `/transactions/new` (no history) | close/save falls back to `/` instead of leaving the app |
| Reduced motion / dark mode | no opacity animation on text; tokens drive both schemes; axe-green both |

## 6. Data changes

None — pure presentation + reuse. No domain/data-model doc changes.

## 7. Interface changes

- **No API change.** New `apps/web/src/QuickAddTransaction.tsx` (route component) + the new
  `apps/web/src/ui/Dialog.tsx` primitive (adds `@radix-ui/react-dialog` to `apps/web`, per `ADR-0005`).
- `AddTransactionForm` gains an **optional** `accounts?: AccountView[]` (picker mode) — the register
  caller is unchanged (it still passes a fixed `accountId`).
- `AllocationEditor` gains an **optional** `disabled?: boolean` gate (defaults false) so the picker can
  hold Save until an account is chosen — register / Needs-allocation callers unchanged.
- `routes.tsx` adds the `transactions/new` child route; `AppShell` adds the **Add transaction** nav
  entry. See [FEAT-UX3](app-shell.md) route map (updated to "as of UX7").

## 8. Dependencies

- **`UX3` (done)** — the router + persistent shell the modal route mounts under.
- **`UX4` (done)** — the token sheet + primitives; `Dialog` is **grown here** (its seed-and-grow
  deferral named `UX7` as the first genuine modal).
- **Slice 1 / 3 (done)** — the `AddTransactionForm` / `AllocationEditor` editor that is reused.

## 9. Security, privacy & accessibility

- No new data exposure; no new endpoint; no new logging (no financial-data-in-logs risk). Inputs are
  validated server-side exactly as the register's path (same `createTransaction`).
- **Accessibility is the headline bar:** the Radix `Dialog` gives a focus trap, `Esc` / overlay close,
  focus-restore, and `role="dialog"` + `aria-labelledby`; **color is never the sole signal**;
  `prefers-reduced-motion` honored. The axe gate runs the open modal in **light and dark**.

## 10. Test plan

- **Unit (Vitest + Testing Library):** `QuickAddTransaction` — opens a labelled dialog with the
  account picker; Save held until an account is chosen; saving posts to the **chosen** account and
  returns; a **partial** allocation's remainder reconciles and surfaces in Needs allocation; `Esc`
  closes; no-accounts → "add an account" link. `Dialog` primitive — labelled `role="dialog"`,
  ESC + close-button dismiss. `AddTransactionForm` register-mode unchanged (existing tests).
- **e2e (Playwright):** open from the nav → pick account → amount → Single allocate → save → returned,
  and the row is recorded against the chosen account; a partial allocation surfaces in Needs
  allocation; `Esc` closes. Plus `e2e/a11y.spec.ts` scans the **open modal** in **light and dark**.
- **Gate:** full gate green; no skipped/failing tests.

## 11. Open questions / decisions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Modal mechanism — true overlay (background visible) vs child route? | agent | **resolved: child route + `Dialog` overlay.** With a data router the background-location overlay is awkward; a child route under the shell + a portal'd `Dialog` + history-safe back gives the modal contract (trap/ESC/return-focus/return-to-where-you-were) cleanly. The Radix portal escapes the keyed `.content` transform, so no fixed-in-transform glitch. |
| `Dialog` build — Radix vs hand-rolled? | Wesley + agent | **resolved: Radix** (`@radix-ui/react-dialog`), per `ADR-0005` (Radix for the hard a11y widgets; Dialog named) + `SPIKE-06` (Radix dialog axe-clean). Lowest a11y risk; +~12 KB gz keeps the bundle < 120 KB. |
| Entry point — shell nav vs cockpit Needs-allocation panel? | agent | **resolved: shell nav** (the brief's "and/or"). Always-available + return-focus-solid (the nav trigger stays mounted across the route change); adding a link inside the NeedsPanel body would break its "all-clear → no link" reconciliation test for no real gain. |
| Forced full allocation on quick-add? | agent | **resolved: no** — partial is allowed; the remainder surfaces in Needs allocation, identical to the register, so the global entry can't silently drop the "needs allocation" signal. |

> **Status: `Implemented`** (gate-green 2026-06-28 — 311 Vitest + 66 e2e; axe light+dark on the open
> modal; build 105.4 KB gz < 120 KB). See the [status report](../status-reports/2026-06-28-ux7.md).
