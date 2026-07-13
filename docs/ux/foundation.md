---
type: ux-spec
roadmap-item: BUD-S1
status: Accepted
---
<!--
UX SPEC — copy of templates/UX-SPEC-TEMPLATE.md. Covers the Foundation surface (Accounts &
Envelopes setup). Pairs with features/accounts.md (FEAT-001) and features/envelopes.md
(FEAT-002). Built BEFORE the slice, per Definition of Ready.
-->

# UX Spec — Foundation (Accounts & Envelopes)

| Field        | Value                                                |
| ------------ | ---------------------------------------------------- |
| Status       | Accepted                                             |
| Feature      | FEAT-001 ([accounts](../features/accounts.md)) · FEAT-002 ([envelopes](../features/envelopes.md)) |
| Owner        | Wesley Cutting                                       |
| Last updated | 2026-06-13                                           |

## 1. User & job

The user is setting up Budgeteer for the first time: creating the **accounts** that mirror
their real bank/card/cash, and the **envelopes** that match how they budget — so the app has
the structure that Slice 1's transaction entry will build on. Ties to the PRD Foundation
scope.

## 2. Entry points & navigation

- The app opens to a **Dashboard** with two sections (or two tabs): **Accounts** and
  **Envelopes**, each listing items + balances, plus a **"Needs allocation"** indicator
  (always `$0.00` until Slice 1).
- From the Dashboard the user can **Add account** and **Add envelope** (inline form or
  modal). No deep navigation in the foundation.

## 3. Primary flow

1. App opens → Dashboard. First run shows empty states for both sections.
2. User clicks **Add account** → enters name, picks a kind, types a starting balance →
   **Save**. The account appears with that balance.
3. User clicks **Add envelope** → enters name, picks kind → **Save**. The envelope appears
   at `$0.00`. *(Optional: "Seed my usual envelopes" adds the 22 names at once.)*
4. User can **rename** any account/envelope inline.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Dashboard | See & set up accounts and envelopes | Accounts list (name · kind · balance); Envelopes list (name · kind · balance); "Add account"/"Add envelope"; "Needs allocation: $0.00" |
| Add/Edit account form | Create or rename an account | name, kind (select), starting balance (only on create); Save / Cancel |
| Add/Edit envelope form | Create or rename an envelope | name, kind (select); Save / Cancel |

States (each list):
- **Empty** — first run: "No accounts yet — add the bank, card, or cash accounts you use."
  / "No envelopes yet — add your budget categories." with a primary **Add** button (and the
  optional **Seed my usual envelopes**).
- **Loading** — fetching from the API: list shows a brief skeleton; the Add buttons stay usable.
- **Populated** — items listed with right-aligned balances (monospaced, `$#,##0.00`,
  negatives shown as `-$x` **and** in a distinct style — not color alone).
- **Error** — validation: inline message under the offending field, input preserved.
  Request failure: a non-destructive banner "Couldn't save — try again," input preserved.
- **Success / confirmation** — the new/renamed item appears (or updates) in place; a brief,
  reduced-motion-respecting highlight.
- **Permission-limited** — n/a in V1 (single implicit household).

## 5. Wireframe / layout

```
+--------------------------------------------------------------+
|  Budgeteer                          Needs allocation: $0.00   |
+----------------------------+---------------------------------+
|  ACCOUNTS      [+ Add]      |  ENVELOPES        [+ Add]       |
|  ------------------------   |  -----------------------------  |
|  Checking   checking  2,140.00 | Rent       standard     0.00 |
|  CapOne     credit    -412.00  | Groceries  standard     0.00 |
|  Cash       cash         60.00 | Vacation   sinking_fund 0.00 |
|  ------------------------   |  -----------------------------  |
|                            |  [ Seed my usual envelopes ]    |
+----------------------------+---------------------------------+

Add account (form/modal):
+-------------------------------------------+
|  Name        [____________________]        |
|  Kind        [ checking ▾ ]                 |
|  Starting $  [ 0.00 ]                       |
|             [ Cancel ]   [ Save account ]   |
+-------------------------------------------+
```

## 6. Interactions & inputs

- **Name:** required, trimmed, unique per household (case-insensitive) — inline error on
  conflict/empty.
- **Kind:** a select; accounts `checking/savings/credit/cash/other`, envelopes
  `standard/sinking_fund`.
- **Starting balance:** text input, parsed to integer cents at the boundary; accepts an
  optional leading `-`, up to 2 decimals; rejects anything else (`"12.345"`, `"1,2"`, letters)
  with "Enter an amount like 1234.56."
- **Save:** disabled while submitting; the create is atomic (account + opening txn).
- **Edge inputs:** `0.00` allowed; negatives allowed (e.g. a credit card); long names truncate visually.

## 7. Content & copy

- Account empty: **"No accounts yet — add the bank, card, or cash accounts you use."**
- Envelope empty: **"No envelopes yet — add your budget categories."**
- Seed action: **"Seed my usual envelopes"**
- Amount error: **"Enter an amount like 1234.56."**
- Name errors: **"Name is required."** / **"An account with that name already exists."**
- Save failure: **"Couldn't save — try again."**

## 8. Accessibility

Baseline **WCAG 2.2 AA**:
- Inputs have associated `<label>`s; the two lists are real tables/lists with headers.
- Balances and negative amounts are distinguished by **text/sign**, not color alone.
- Fully keyboard-operable; visible focus ring; modal traps focus and restores it on close;
  respects `prefers-reduced-motion` for the highlight.
- Errors are associated with their field (`aria-describedby`) and announced politely.

## 9. Acceptance criteria (UX)

- **Given** first run, **when** the Dashboard loads, **then** both empty states render as specified.
- **Given** a valid account form, **when** I Save, **then** the account appears with the
  entered balance and the form resets/closes.
- **Given** an invalid amount or duplicate name, **when** I Save, **then** an inline error
  shows and nothing is created.
- The empty / loading / error / success states render as specified; a11y checks pass on the view.

## 10. Out of scope / later

Transaction entry & splitting (Slice 1), archiving (slice #6), monthly targets, the
"Needs allocation" list actually having items (Slice 1).
