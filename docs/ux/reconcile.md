<!--
UX SPEC — #10: reconcile to bank. A Reconcile panel on the account register (derived vs.
entered balance, live difference, record, last-reconciled). Pairs with FEAT-010.
-->

# UX Spec — Reconcile to bank

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-010 ([feature spec](../features/reconcile.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-15                                     |

## 1. User & job

The user opens an account, reads the real balance off their bank, and checks it against
Budgeteer — confirming a match or seeing exactly how far (and which way) they've drifted, then
recording the check.

## 2. Entry point & navigation

A **Reconcile** panel on the **account register** (open an account from the Dashboard), below
Add transaction / Transfer money. It uses the account's already-shown derived balance.

## 3. Primary flow

1. Open an account → **Reconcile** → see **Budgeteer balance: $X**.
2. Type **Your bank balance** → a **live difference** appears (`Difference: $Y (bank −
   Budgeteer)`, or **Matches your bank ✓**).
3. **Record reconciliation** → a confirmation (`Reconciled — matches your bank.` or `Recorded —
   off by $Y.`) and a **Last reconciled $… on … ** line. The history updates.
4. If off, the user adds/edits transactions to close the gap, then reconciles again.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Account register → Reconcile | Compare to the bank | **Budgeteer balance** · **Your bank balance** input · **live difference** · **Record reconciliation** · **last reconciled** line |

States:
- **No input** — no difference shown yet.
- **Matched** — "Matches your bank ✓".
- **Difference** — "Difference: $Y (bank − Budgeteer)" (positive = bank ahead; negative = behind).
- **Recorded** — `role="status"` confirmation; history line updates.
- **Error** — `role="alert"` (unparseable amount).
- **Never reconciled** — "Not yet reconciled."

## 5. Wireframe / layout

```
RECONCILE
  Budgeteer balance: $750.00
  Your bank balance [ 800.00 ]   Difference: $50.00 (bank − Budgeteer)   [ Record reconciliation ]
  Last reconciled $800.00 on 2026-06-15 (off by $50.00)
```

## 6. Interactions & inputs

- The difference recomputes **live** as you type (client-side: bank − Budgeteer).
- **Record** snapshots the derived balance server-side and stores the row; the panel reloads its
  history. Recording is allowed even when not matched (the history captures drift).
- Negative amounts are accepted (credit/overdraft accounts).

## 7. Content & copy

- Heading **"Reconcile"**; **"Budgeteer balance:"**, **"Your bank balance"**, button **"Record
  reconciliation"**; outcomes **"Matches your bank ✓"** / **"Difference: … (bank − Budgeteer)"**
  / **"Reconciled — matches your bank."** / **"Recorded — off by …"**.

## 8. Accessibility

Labeled `form` ("Reconcile") + labeled input ("Bank balance"); the live difference and outcome
are text (`role="status"`/`role="alert"`), not color; keyboard-operable.

## 9. Acceptance criteria (UX)

- **Given** a balance, **when** I type a different bank balance, **then** the signed difference
  shows before I record.
- **Given** I record, **then** I see a confirmation and a "last reconciled" line.
- **Given** equal balances, **then** I see "Matches your bank ✓" and a clean reconcile.

## 10. Out of scope / later

A per-transaction cleared/checkoff workflow; an "create adjustment" button; reconciling from the
Dashboard; editing/deleting a past reconciliation.
