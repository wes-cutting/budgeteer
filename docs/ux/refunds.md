---
type: ux-spec
roadmap-item: BUD-S8
status: Accepted
---
<!--
UX SPEC — #8: refund rows within a split. Extends the FEAT-003 allocation editor with a per-row
Refund toggle. Pairs with FEAT-008.
-->

# UX Spec — Refunds (refund rows within a split)

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-008 ([feature spec](../features/refunds.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-14                                     |

## 1. User & job

The user records a single transaction that mixes spending and a return — e.g. a receipt that's
mostly a purchase but includes one returned item — so the entry matches the bank and credits the
right envelope back, without splitting it into two transactions.

## 2. Entry point & navigation

In the **split allocation editor** (on Add transaction, Edit split, and Allocate-later), each
**Split** row gains a **Refund** checkbox next to its amount. (Single mode is unaffected —
refunds are a split concept.)

## 3. Primary flow

1. Enter a withdrawal (e.g. `70.00`) → choose **Split**.
2. Row 1: Groceries `100.00` (a spend). **Add row** → Row 2: Gas `30.00`, tick **Refund**.
3. The **Allocated/Remaining** line nets the refund (`−100 + 30 = −70`): **Remaining 0.00** →
   **Save** enables. Save → the account drops `70.00`, Groceries `−100.00`, **Gas `+30.00`**.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Allocation editor (Split) | Mix spend + refund rows | Per-row: Envelope · Amount (positive) · **Refund** checkbox · use-remaining · ✕; live **Allocated/Remaining** |

States:
- **Normal** — "Allocated X · Remaining Y" (refund rows reduce Allocated).
- **Over-allocated** — "Over-allocated by X" + Save disabled (net exceeds the amount).
- **Refunds exceed** — "Refunds exceed the amount by X" + Save disabled (net would flip the
  transaction's direction → enter it as a deposit instead).
- **Edit** — reopening a saved transaction shows refund rows with the **Refund** box checked and
  a positive magnitude.

## 5. Wireframe / layout

```
ALLOCATE  ( ) Single  (•) Split
  [ Groceries ▼ ]  [ 100.00 ]  ☐ Refund   [use remaining] [✕]
  [ Gas       ▼ ]  [  30.00 ]  ☑ Refund   [use remaining] [✕]
  [ Add row ] [ distribute remaining ]
  Allocated -$70.00 · Remaining $0.00          [ Save transaction ]
```

## 6. Interactions & inputs

- **Refund** flips a row's contribution from spend (toward the amount) to credit (against it);
  the amount stays a positive magnitude.
- **distribute remaining** spreads the remainder across **normal rows only** (refund rows are
  exceptions, never remainder-fillers).
- Save is disabled on over-allocation **or** a net-direction flip; the server enforces the same
  invariant defensively (`400`).

## 7. Content & copy

- Control: **"Refund"** (per-row checkbox).
- Status: **"Allocated … · Remaining …"** / **"Over-allocated by …"** / **"Refunds exceed the
  amount by …"**.

## 8. Accessibility

Each Refund checkbox is labeled (`Refund for row N`); the Allocated/Remaining status is text (not
color); the whole editor stays keyboard-operable (Enter adds the next row).

## 9. Acceptance criteria (UX)

- **Given** a withdrawal split, **when** I mark a row **Refund**, **then** Allocated decreases by
  that row and Remaining updates accordingly.
- **Given** refund rows that flip the net positive, **then** I see "Refunds exceed the amount"
  and Save is disabled.
- **Given** a saved transaction with a refund row, **when** I Edit split, **then** the row shows
  **Refund** checked with a positive amount.

## 10. Out of scope / later

A dedicated refund-transaction type; per-row magnitude caps; a register badge for refunded rows.
