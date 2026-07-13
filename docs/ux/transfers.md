---
type: ux-spec
roadmap-item: [BUD-S6, BUD-S7]
status: Accepted
---
<!--
UX SPEC — #7a: account↔account transfer. A "Transfer money" form on the account register +
labeled transfer legs. Pairs with FEAT-007. #7b (envelope reallocation) gets its own UX.
-->

# UX Spec — Transfers

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Status       | Accepted (#7a account transfer + #7b envelope reallocation) |
| Feature      | FEAT-007 ([feature spec](../features/transfers.md)) |
| Owner        | Wesley Cutting                                     |
| Last updated | 2026-06-14                                         |

## 1. User & job

From an account, the user moves money to another of their accounts (e.g. checking → savings)
so the app's balances mirror what the bank did — without re-budgeting any envelope.

## 2. Entry points & navigation

On the **account register** (open an account from the Dashboard), a **Transfer money** section
sits below **Add transaction**. The source account is the account being viewed; the user picks
a **destination** account and an **amount**.

## 3. Primary flow

1. Open an account → **Transfer money** → choose a **To account**, type an **Amount** (and an
   optional **Memo**) → **Transfer**.
2. The form clears; the register shows a new **"Transfer to <account>"** leg; the account
   **Balance** drops by the amount. The destination account's register shows the mirror
   **"Transfer from <account>"** leg.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Account register → Transfer money | Move money to another account | **To account** select (other **active** accounts only), **Amount**, **Memo**, **Transfer** button |
| Account register → Transactions | See the movement | Transfer leg row: date · **"Transfer to/from <account>"** · signed amount (no allocation status / no editor) |

States:
- **No other accounts** — "Add another account to transfer money to." (form hidden).
- **Validation error** — inline `role="alert"` (e.g. "Choose an account to transfer to.",
  server messages for same-account / amount).
- **Loading / Success** — submit disables the button; on success the register + balance refresh
  (reduced-motion).

## 5. Wireframe / layout

```
TRANSFER MONEY
  To account [ Savings ▼ ]   Amount [ 250.00 ]   Memo [ Monthly savings ]   [ Transfer ]

TRANSACTIONS
  2026-06-14   Transfer to Savings        -$250.00
  2026-06-13   Opening balance          $1,000.00   fully allocated
```

## 6. Interactions & inputs

- **To account** lists only **active** accounts other than the one being viewed (the source is
  never offered as its own destination).
- **Amount** is a positive decimal string, parsed to integer cents at the boundary (ADR-0003).
- A **transfer leg** is read-only in the register: no "needs/fully allocated" text and **no**
  allocation editor (it carries no envelope allocation).

## 7. Content & copy

- Section heading: **"Transfer money"**; button **"Transfer"**.
- Register leg: **"Transfer to <account>"** (source, negative) / **"Transfer from <account>"**
  (destination, positive).

## 8. Accessibility

The form is a labeled `form` ("Transfer money") with labeled `select`/inputs; the button has a
clear label; direction is conveyed by text + sign, not color; errors via `role="alert"`;
fully keyboard-operable.

## 9. Acceptance criteria (UX)

- **Given** two accounts, **when** I transfer from the open account, **then** a labeled
  transfer leg appears and the account balance updates.
- **Given** the open account, **when** I view the destination picker, **then** the open account
  is not listed.
- **Given** a transfer leg, **when** it renders, **then** it shows no allocation status and no
  edit-split control.

## 10. Out of scope / later

Editing/deleting a transfer or reallocation; account transfers initiated from the Dashboard
(global); choosing an **archived** envelope as a reallocation source in the UI (the API allows
draining-from-archived; the picker offers active envelopes only for now).

## 11. #7b — envelope↔envelope reallocation (Move money)

**Job:** the user re-budgets money between two envelopes (e.g. Groceries → Vacation) without
touching any account.

**Entry point:** on the **Dashboard**, below the Envelopes list, a **Move money between
envelopes** form: **From envelope**, **To envelope**, **Amount**, optional **Memo**, **Move
money**. Both pickers list **active** envelopes only; the form is hidden until there are at
least two active envelopes.

**Flow:** pick from/to + amount → **Move money** → the form clears and both envelope balances
update in place (the source drops, the destination rises). Accounts are unaffected.

**States:** **client guards** (both envelopes required; must differ) and **server messages**
(amount, archived destination) surface inline via `role="alert"`. Submit disables while saving;
balances refresh on success (reduced-motion).

```
ENVELOPES                         [+ Add]
  Groceries   standard  $450.00   [ Archive ]
  Vacation    sinking_fund  $550.00   [ Archive ]
  MOVE MONEY BETWEEN ENVELOPES
    From [ Groceries ▼ ]  To [ Vacation ▼ ]  Amount [ 150.00 ]  Memo [ ]  [ Move money ]
```

**Accessibility:** labeled `form` ("Move money between envelopes") with labeled selects/inputs;
errors via `role="alert"`; keyboard-operable; no color-only signaling.

**Acceptance (UX):** moving updates both envelope balances on the Dashboard; selecting the same
envelope on both sides (or a zero amount) shows an inline error and moves nothing.
