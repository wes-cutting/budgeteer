<!--
FEATURE SPEC — #10: reconcile to bank (manual balance compare + recorded history). Plain
compare (no per-transaction cleared concept). Pairs with docs/ux/reconcile.md.
-->

# Feature Spec — Reconcile to bank

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-010                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-15                             |
| Related      | [Accounts](accounts.md) (FEAT-001) · [Transactions](transactions.md) (FEAT-003) · [UX](../ux/reconcile.md) · [Domain](../04_DOMAIN_MODEL.md) · [API](../06_API_CONTRACT.md) · PRD §9 (open Q resolved) |

## 1. Summary

Compare an account's **derived** balance (the book — Σ of its transactions) against the real
**statement** balance the user reads off their bank, see the **difference**, and **record** the
reconciliation so each account keeps a "last reconciled" history. This realizes the PRD's core
promise — "account balances reconcile to actual bank balances" — which the source spreadsheet
never did. V1 is a **plain compare**: no per-transaction *cleared* concept; on a mismatch the app
just **shows the difference** (the user fixes drift by adding/editing transactions, then re-checks).

## 2. Scope

- **In scope** — enter your real bank balance for an account; see derived vs. statement + the
  signed difference (live, before saving); **record** a reconciliation (snapshots the derived
  balance + statement + date); per-account reconciliation **history** ("last reconciled …").
- **Out of scope** — a per-transaction cleared/statement-checkoff workflow (deferred; PRD §9);
  auto-creating an **adjustment** transaction for the difference (owner chose "just show it");
  locking/immutability of reconciled transactions; multi-account statement import.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to compare an account to my real bank balance so I trust the numbers. | Must |
| US-2 | As the user, I want to see exactly how far off I am (and which way) when they differ. | Must |
| US-3 | As the user, I want a record of when I last reconciled and to what balance. | Should |
| US-4 | As the user, I want negative balances to work (e.g. a credit account). | Should |

## 4. Acceptance criteria

- **Given** an account whose derived balance is `750.00`, **when** I enter a bank balance of
  `800.00`, **then** I see a **+$50.00** difference (bank − Budgeteer) **before** recording.
- **Given** I record that, **then** a reconciliation is stored with the **snapshot** derived
  balance (`750.00`), the statement (`800.00`), the difference (`+50.00`), and the date; the
  account shows **"last reconciled $800.00 on …"**.
- **Given** the entered balance equals the derived balance, **then** it shows **matched** and
  records `difference = 0`.
- **Given** a negative statement balance (`-125.50`), **then** it's accepted and the difference
  computed normally.
- **Invalid** input (unparseable amount) → `400`; **missing account** → `404`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Difference ≠ 0 | Recorded anyway (history captures drift); the difference is shown, not auto-corrected. |
| Derived balance changes later (a past txn is edited) | Past reconciliations keep their **snapshot** `derived_balance_cents` (historical truth); a new reconciliation re-snapshots. |
| Negative balances (credit/overdraft) | Allowed on both sides; `parseMoney` accepts a leading `-`. |
| No reconciliations yet | The panel shows "Not yet reconciled." |

## 6. Data changes

New table ([05_DATA_MODEL](../05_DATA_MODEL.md)): **`reconciliations`** (`account_id`,
`statement_balance_cents`, `derived_balance_cents` snapshot, `reconciled_on`, `created_at`).
**No** change to transactions or balance views — reconciliation is a recorded compare, not a
ledger entry; the difference is **derived** (`statement − derived`), never stored.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):
- `POST /accounts/:accountId/reconciliations` `{ statementBalance: string, reconciledOn?: "YYYY-MM-DD" }` → `201 { reconciliation }`.
- `GET /accounts/:accountId/reconciliations` → history (newest first).

`ReconciliationView = { id, accountId, statementBalanceCents, derivedBalanceCents, differenceCents,
matched, reconciledOn }`. UI: a **Reconcile** panel on the account register (derived balance, a
bank-balance input with a live difference, **Record reconciliation**, and a last-reconciled line)
— see [UX](../ux/reconcile.md).

## 8. Dependencies

Accounts + derived balances (FEAT-001 / `v_account_balances`). Domain `reconciliationDelta`
(sign convention: `difference = statement − derived`).

## 9. Security, privacy & accessibility

Household-scoped; the account is validated server-side (missing → `404`). The statement amount is
parsed/validated at the boundary (integer cents, ADR-0003). The panel uses a labeled form/input;
the difference and outcome are conveyed as text (`role="status"`/`role="alert"`), not color.

## 10. Test plan

- **Unit (domain):** `reconciliationDelta` — matched, positive (bank ahead), negative (bank
  behind), negative balances exact ([reconcile.test.ts](../../packages/domain/test/reconcile.test.ts)).
- **Integration (API):** record snapshots derived + computes difference; matched case; negative
  statement; history newest-first; bad amount `400`; missing account `404`.
- **Component (web):** the panel shows the live difference, records, surfaces "last reconciled",
  and handles the matched case.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Add a per-transaction cleared/statement-checkoff workflow later? | Wesley | open (V1: plain compare) |
| Offer an optional "create adjustment transaction" for the difference? | Wesley | open (V1: show only) |
