<!--
FEATURE SPEC — R15: envelope ledger (per-envelope allocation list). Pairs with
docs/ux/envelope-ledger.md. No schema change — data is already in allocations ⋈ transactions.
-->

# Feature Spec — Envelope ledger

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-015                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-21                             |
| Related      | [UX spec](../ux/envelope-ledger.md) · [Transactions](transactions.md) · [API](../06_API_CONTRACT.md) · [Data model](../05_DATA_MODEL.md) |

## 1. Summary

Show every allocation that contributed to an envelope's balance — a read-only per-envelope
ledger. Today the Dashboard shows a derived `balanceCents` for each envelope but gives no way
to answer "what transactions are in this envelope and when?". This feature adds a drill-down
view: click an envelope → see a newest-first list of allocation rows, each carrying the date,
payee, source account, and signed amount. No schema change is required; the data is already
present in `allocations ⋈ transactions ⋈ accounts`.

## 2. Scope

- **In scope** — list all allocations for a single envelope, newest first; each row shows
  date · payee/memo · source account name · signed amount (`+` = funded, `−` = spent); scope
  to the default household; include `kind='opening'` and `kind='transfer'` rows (those can
  allocate to envelopes just like normal transactions).
- **Out of scope** — envelope↔envelope reallocations (`envelope_transfers`) inline in this
  view (they affect the balance but are a separate concept; the balance header accounts for
  them); editing or deleting allocations from this view; pagination (V1 data volumes are
  small); search/filter within the ledger (a later addition, cf. R8 for accounts).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to click into an envelope and see every transaction that touched it — date, payee, account, amount — so I can understand why its balance is what it is. | Must |
| US-2 | As the user, I want to navigate back to the Dashboard from the envelope ledger without losing my place. | Must |
| US-3 | As the user, I want to see the same ledger for an archived envelope (its history should still be readable). | Should |

## 4. Acceptance criteria

- **Given** an envelope with allocations, **when** I open its ledger, **then** I see a
  newest-first list; each row shows the transaction date, payee (or memo if no payee), source
  account name, and signed allocation amount.
- **Given** an envelope with no allocations, **when** I open its ledger, **then** I see an
  empty state: "No transactions in this envelope yet."
- **Given** a missing or wrong-household envelope id, **when** `GET /envelopes/:id/ledger` is
  called, **then** `404`.
- **Given** an archived envelope, **when** I open its ledger, **then** I see its history
  (identical to an active envelope — archive only blocks new allocations, not reads).
- **Given** any envelope ledger row, **when** I look at the amount, **then** positive amounts
  are deposits/funding and negative amounts are withdrawals/spend.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Envelope has only an opening-balance allocation | The opening transaction row is shown with `kind='opening'` amounts. |
| Allocation came from a `kind='transfer'` leg | Shown normally — the source account column names the account the transfer moved from/to, so the origin is clear. |
| Envelope has envelope-transfer reallocations but no direct allocations | Ledger shows empty (reallocations are out of scope for this view); the balance header still reflects them. |
| Very large allocation count | Load all in V1 (data volumes are small); no pagination needed yet. |
| Network error loading ledger | Error banner with retry; does not crash the app. |

## 6. Data changes

None. The query is a read-only join over existing tables:

```sql
SELECT
  a.id              AS allocation_id,
  t.id              AS transaction_id,
  t.occurred_on,
  t.payee,
  t.memo,
  t.kind            AS transaction_kind,
  ac.id             AS account_id,
  ac.name           AS account_name,
  a.amount_cents                        -- signed (same sign as its transaction)
FROM allocations a
JOIN transactions t  ON t.id  = a.transaction_id
JOIN accounts     ac ON ac.id = t.account_id
WHERE a.envelope_id = $envelopeId
  AND t.household_id = $householdId
ORDER BY t.occurred_on DESC, t.created_at DESC;
```

The `household_id` scoping is via the `transactions` join (denormalized there for exactly this
query pattern), consistent with every other service query in the API.

## 7. Interface changes

**New API endpoint** ([06_API_CONTRACT](../06_API_CONTRACT.md)):

```
GET /envelopes/:id/ledger
→ 200 { rows: EnvelopeLedgerRow[] }
→ 404 if envelope not found or wrong household
```

```
EnvelopeLedgerRow = {
  allocationId:    string
  transactionId:   string
  occurredOn:      "YYYY-MM-DD"
  payee:           string | null
  memo:            string | null
  transactionKind: "opening" | "normal" | "transfer"
  accountId:       string
  accountName:     string
  amountCents:     number   // signed integer cents
}
```

**New UI**: `EnvelopeLedger.tsx` — a panel opened by clicking an envelope name on the
Dashboard. Mirrors the structural pattern of `AccountRegister.tsx`. See
[UX spec](../ux/envelope-ledger.md).

## 8. Dependencies

- **#3** (transactions + allocations): provides the data.
- **#1** (accounts): account names shown in ledger rows.
- **R14** (e2e expansion, ✅ done): e2e convention established; this feature lands with
  `e2e/envelopes.spec.ts` extended (or a new `e2e/envelope-ledger.spec.ts`).

## 9. Security, privacy & accessibility

- All queries are household-scoped via `transactions.household_id` — the same scoping pattern
  as every other service. No cross-household data can leak.
- The ledger is read-only; no write surface in this slice.
- Accessibility: the ledger is a table with proper column headers; amounts convey sign via
  text (`+`/`−`) not color alone; "back to Dashboard" is a labeled link/button; empty and
  error states are announced; consistent with WCAG 2.2 AA (see UX spec §8).

## 10. Test plan

- **Integration (API):** ledger returns rows in newest-first order; amounts are signed
  correctly; `opening` and `transfer` kind rows are included; wrong-household / missing
  envelope → 404; empty envelope → empty array (200).
- **Component (web):** ledger renders rows with correct content; empty state shows message;
  back navigation returns to Dashboard; archived envelope shows history.
- **e2e:** click envelope on Dashboard → see ledger rows matching prior entered transactions →
  back button returns to Dashboard. Lands in `e2e/envelopes.spec.ts`.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Should envelope_transfers (reallocations) appear as rows in the ledger with a distinct visual treatment? | Wesley | open — descoped for V1, revisit if users find the balance hard to reconcile to the ledger |
| Clicking a ledger row — should it navigate to the source account register at that transaction? | Wesley | open — natural cross-link but out of scope for this slice |
| Date-range filtering (à la R8 for accounts)? | Wesley | open — descoped; add alongside R8 if wanted |
