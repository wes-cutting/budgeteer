<!--
UX SPEC — R15: envelope ledger. Built alongside the feature spec (Definition of Ready).
Pairs with features/envelope-ledger.md (FEAT-015).
-->

# UX Spec — Envelope ledger

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | Proposed                                                       |
| Feature      | FEAT-015 ([feature spec](../features/envelope-ledger.md))      |
| Owner        | Wesley Cutting                                                 |
| Last updated | 2026-06-21                                                     |

## 1. User & job

The user wants to understand what is in a specific envelope — which transactions funded it or
drew from it, and when. Today the Dashboard only shows the envelope's derived balance; there is
no way to drill into the individual allocations. This view closes that gap: click an envelope,
see its ledger. Ties to PRD goal "Review trends and breakdowns" and the core principle that
balances should always be explainable.

## 2. Entry points & navigation

- **Entry:** click an envelope's name (or a dedicated "View ledger" link) on the Dashboard
  envelope list — active or archived.
- **Back:** a "← Dashboard" link/button at the top of the ledger panel returns to the
  Dashboard, preserving scroll position if practical.
- No other navigation into the ledger (no deep link required in V1).

## 3. Primary flow

1. User is on the Dashboard, sees the envelope list with balances.
2. User clicks the "Groceries" envelope name.
3. The ledger panel opens (or navigates, matching the AccountRegister pattern). It shows
   the envelope name, its current balance, and a newest-first list of allocation rows.
4. Each row: date · payee (or memo fallback) · account name · signed amount.
5. User reads the history and clicks **← Dashboard** to return.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Envelope ledger | Show all allocations for one envelope, newest first | Envelope name · balance · back link · row list (date · payee · account · amount) |

States:

- **Empty** — the envelope has no allocations yet (balance is `$0.00`):
  "No transactions in this envelope yet."
- **Loading** — fetching from `GET /envelopes/:id/ledger`: list placeholder (skeleton or
  "Loading…"); envelope name and back link visible immediately.
- **Populated** — table of allocation rows, newest first. Rows for `opening` transactions
  may show "(opening balance)" as a payee fallback.
- **Error** — request failed: "Couldn't load ledger — try again." with a retry action; does
  not crash the Dashboard.
- **Archived envelope** — identical to Populated but the envelope name includes an
  "(archived)" badge; the allocation history is fully readable.
- **Permission-limited** — n/a in V1 (single household).

## 5. Wireframe / layout

```
GROCERIES (standard)                Balance: $487.30      [ ← Dashboard ]
──────────────────────────────────────────────────────────────────
  Date         Payee / Memo          Account               Amount
  2026-06-16   Whole Foods           Everyday Checking     −$165.00
  2026-06-05   Trader Joe's          Everyday Checking     −$178.00
  2026-06-01   Employer Direct…      Everyday Checking     +$600.00
  2026-05-17   Whole Foods           Everyday Checking     −$165.00
  2026-05-04   Trader Joe's          Everyday Checking     −$178.00
  2026-05-01   Employer Direct…      Everyday Checking     +$600.00
  …
──────────────────────────────────────────────────────────────────
  EMERGENCY FUND (sinking fund) (archived)   Balance: $895.00   [ ← Dashboard ]
  Date         Payee / Memo          Account               Amount
  2026-06-01   Employer Direct…      Everyday Checking     +$250.00
  2026-05-01   Employer Direct…      Everyday Checking     +$250.00
  2026-03-31   (opening balance)     Emergency Savings     +$820.00
  …
```

Notes:
- Payee is shown if set; otherwise memo; otherwise "(opening balance)" for `kind='opening'`
  rows with no payee/memo; otherwise "—".
- Amounts: `+` prefix for positive (funded), `−` prefix for negative (spent). Negative
  amounts visually distinct — not by color alone (bold or parentheses as a fallback).
- Table is not paginated in V1; all rows load at once.
- Layout mirrors `AccountRegister` to keep the visual language consistent.

## 6. Interactions & inputs

- **Click to open:** clicking the envelope name on the Dashboard triggers navigation or panel
  open (match the `AccountRegister` pattern — whichever the app uses for drill-down).
- **Back link:** always visible at the top; keyboard-operable; returns to Dashboard.
- **No write actions** in this view — it is read-only.
- **Retry on error:** a single "Try again" button re-fetches from the API.
- Long payee/account text: truncate with ellipsis; full text on hover/focus (tooltip or
  title attribute).

## 7. Content & copy

| Context | Copy |
| ------- | ---- |
| Page / panel heading | `{Envelope name}` (the envelope's name, not "Envelope ledger") |
| Sub-heading / kind badge | `(standard)` or `(sinking fund)`; `(archived)` appended if archived |
| Back link | `← Dashboard` |
| Empty state | `No transactions in this envelope yet.` |
| Loading | `Loading…` (or a skeleton row) |
| Error | `Couldn't load ledger — try again.` |
| Payee fallback (no payee and no memo) | `—` |
| Payee fallback for opening balances | `(opening balance)` |
| Amount positive prefix | `+` |
| Amount negative prefix | `−` (minus sign, not a hyphen) |
| Archived badge | `(archived)` next to envelope name |

## 8. Accessibility

Baseline **WCAG 2.2 AA**:
- The ledger is a `<table>` with `<th>` column headers (Date, Payee / Memo, Account, Amount)
  and a `<caption>` or `aria-labelledby` pointing to the envelope name heading.
- Positive/negative amounts are conveyed by the `+`/`−` prefix in text — not color alone.
  Negative amounts may additionally use a visually distinct style (bold or parentheses) for
  redundant cuing, matching the existing `AccountRegister` convention.
- The "← Dashboard" back link is a real `<a>` or `<button>` with visible focus indicator.
- Empty, loading, and error states are in the DOM (not hidden); error uses `role="alert"` or
  equivalent so assistive technology announces it.
- `prefers-reduced-motion` respected (no slide/fade animations, or instant transitions).
- The archived badge is a `<span>` with visually and programmatically distinct text —
  not a color-only indicator.

## 9. Acceptance criteria (UX)

- **Given** an envelope with 3 allocations across 2 months, **when** I open its ledger,
  **then** I see 3 rows in newest-first order, each with the correct date, payee, account,
  and signed amount.
- **Given** an empty envelope, **when** I open its ledger, **then** I see "No transactions in
  this envelope yet." and no table rows.
- **Given** the ledger is loading, **when** I click "← Dashboard", **then** I can navigate
  back without error (loading is cancelled / state is cleaned up).
- **Given** the API returns an error, **when** the ledger attempts to load, **then** the
  error message appears with a "Try again" action; the Dashboard is still reachable via the
  back link.
- **Given** an archived envelope, **when** I open its ledger, **then** the name shows
  "(archived)" and all historical rows are readable.
- All accessibility checks in §8 pass on the new surface.

## 10. Out of scope / later

- Envelope-transfer (reallocation) rows inline in the ledger.
- Clicking a row to navigate to the source account register at that transaction.
- Date-range or payee filtering within the ledger.
- Pagination.
- Editing or deleting allocations from this view.
