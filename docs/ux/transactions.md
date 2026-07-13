---
type: ux-spec
roadmap-item: BUD-S2
status: Accepted
---
<!--
UX SPEC — Slice 1: the account register, add-transaction, the allocation editor, and the
needs-allocation list. Built BEFORE the slice (Definition of Ready). Pairs with FEAT-003.
-->

# UX Spec — Transactions & split allocation

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Status       | Accepted                                         |
| Feature      | FEAT-003 ([feature spec](../features/transactions.md)) |
| Owner        | Wesley Cutting                                   |
| Last updated | 2026-06-13                                       |

## 1. User & job

The user records real money movements once at the account level and splits each across the
envelopes it funds/draws — fast for the common one-envelope case, tolerable for a many-way
paycheck split — keeping accounts reconciled and the budget current. Ties to PRD journeys 1–4.

## 2. Entry points & navigation

- From the **Dashboard**, each account links to its **Account register**; a **"Needs
  allocation (N)"** control opens the needs-allocation list. Both link back to the Dashboard.
- The **allocation editor** appears inline in the add-transaction form and in the
  allocate-later flow (same component).

## 3. Primary flow

1. Open an account → see its register (transactions, newest first) + **Add transaction**.
2. Choose **Deposit**/**Withdrawal**, enter amount, payee, date.
3. Allocate: **Single** (pick one envelope — gets the full amount) or **Split** (rows of
   envelope + amount, with a live `Allocated / Remaining`). Optionally leave a remainder.
4. Save → the register and balances update. Any remainder shows under **Needs allocation**.
5. Later, open a needs-allocation item → finish allocating with the same editor.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Account register | See/add transactions for one account | Account name + balance; transaction list (date · payee · amount · allocated/unallocated); Add-transaction form |
| Allocation editor | Split an amount across envelopes | Mode toggle Single/Split; rows (envelope select + amount); `Allocated / Remaining`; "use remaining"; Save |
| Needs allocation | Finish partials (incl. opening balances) | List (account · payee · amount · unallocated) with an **Allocate** action per row |

States:
- **Empty** — register: "No transactions yet — add your first one." Needs-allocation: "Nothing to
  allocate — you're all caught up."
- **Loading** — list skeleton; forms usable when data not required.
- **Populated** — transactions newest-first; each shows allocated vs unallocated.
- **Error** — inline under the form/field, input preserved ("Couldn't save — try again." or the
  server's message, e.g. over-allocation / unknown envelope).
- **Success** — the transaction appears in the register; remainder (if any) reflected in
  Needs-allocation; reduced-motion-respecting highlight.
- **Permission-limited** — n/a (single household).

## 5. Wireframe / layout

```
ACCOUNT: Checking            Balance: $2,140.00      [ ← Dashboard ]  [ Needs allocation (2) ]
──────────────────────────────────────────────────────────────────────────────
ADD TRANSACTION
  (•) Deposit  ( ) Withdrawal   Amount [ 3200.00 ]  Date [2026-06-13]  Payee [ Employer ]

  ALLOCATE                                  ( ) Single   (•) Split
   Envelope            Amount
   [ Rent       ▾ ]    [ 1400.00 ]  (use remaining)   ✕
   [ Groceries  ▾ ]    [  600.00 ]  (use remaining)   ✕
   [ + add row ]
   Allocated $2,000.00   Remaining $1,200.00          [ Save transaction ]
──────────────────────────────────────────────────────────────────────────────
REGISTER
  2026-06-13  Employer    +$3,200.00   allocated $2,000.00 · needs $1,200.00
  2026-06-12  Shell        -$48.20     fully allocated
```

## 6. Interactions & inputs

- **Amount** (transaction): positive decimal magnitude; sign comes from Deposit/Withdrawal.
- **Single mode:** one envelope select; the amount is the full transaction amount (read-only).
- **Split mode:** each row = envelope select + amount (positive). `Remaining = amount − Σ rows`,
  shown live. **"use remaining"** fills that row with the current Remaining (the SPIKE-01
  last-row behavior); exact to the cent.
- **Save** is allowed while `Remaining ≥ 0` (partial OK); **disabled when `Remaining < 0`**
  (over-allocated) with an inline note. Disabled while submitting.
- **Allocate-later:** opens the editor pre-filled with existing rows; saving replaces them.
- Edge: 0/negative amount rejected; archived/unknown envelope rejected by the server.

## 7. Content & copy

- Mode: **"Single"** / **"Split"**; **"use remaining"**; **"+ add row"**.
- Tally: **"Allocated {x}"**, **"Remaining {y}"**; over: **"Over-allocated by {z}."**
- Register empty: **"No transactions yet — add your first one."**
- Needs-allocation empty: **"Nothing to allocate — you're all caught up."**
- Save error: **"Couldn't save — try again."** (or the server message).

## 8. Accessibility

Baseline **WCAG 2.2 AA**:
- Inputs/labels associated; the mode toggle is a labeled radio group; the register is a list/table.
- `Remaining`/over-allocation conveyed as **text**, not color alone; errors via `aria-describedby`,
  announced politely.
- Keyboard-operable rows (add/remove/use-remaining are buttons); visible focus; respects
  `prefers-reduced-motion`.

## 9. Acceptance criteria (UX)

- **Given** Split mode with amount `3200` and rows `1400/600`, **then** `Remaining` shows
  `1200.00` and Save is enabled (partial).
- **Given** rows summing `> amount`, **then** Save is disabled and an over-allocation note shows.
- **Given** "use remaining" on a row, **then** that row fills so `Remaining` becomes `0.00`.
- **Given** a saved partial, **then** it appears in the register and in Needs-allocation.
- Empty/loading/error states render as specified; a11y checks pass.

## 10. Out of scope / later

Templates/keyboard-first/distribute-remainder (Slice 2); editing a fully-allocated split (#5);
transfers/refunds/recurring; pagination.
