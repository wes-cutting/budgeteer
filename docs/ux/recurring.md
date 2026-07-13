---
type: ux-spec
roadmap-item: BUD-S9
status: Accepted
---
<!--
UX SPEC — #9: recurring transactions. A Recurring page (create form reusing the split editor,
rule list, Post due). Pairs with FEAT-009.
-->

# UX Spec — Recurring transactions

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-009 ([feature spec](../features/recurring.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-14                                     |

## 1. User & job

The user sets up the transactions that repeat — a biweekly paycheck, monthly rent/subscriptions
— once, with the split they always use, then posts them in one click whenever they come due.

## 2. Entry point & navigation

A **Recurring** button in the Dashboard header opens the **Recurring** page (← Dashboard to
return). The page header also holds the **Post due** action.

## 3. Primary flow

1. **New recurring rule**: pick an account, Deposit/Withdrawal, an amount, optional payee, a
   **frequency** (weekly/biweekly/monthly) and a **first date**; define the **split** in the
   editor; **Create recurring rule**.
2. The rule appears under **Your recurring rules** with its account, amount, frequency, **next
   date**, and a **due** badge (or "up to date").
3. **Post due** → generates the due transactions, shows "Posted N transactions.", and the rules
   refresh to "up to date". Posting again shows "Nothing due right now." (idempotent).
4. **Delete** removes a rule (its already-generated transactions stay in the register).

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Recurring → New rule | Define a scheduled transaction | Account select · Deposit/Withdrawal · Amount · Payee · Frequency · First date · **split editor** (Create recurring rule) |
| Recurring → Rules list | See/manage rules | Per rule: account · direction · amount · frequency · **next date** · **due count** / "up to date" · split summary · **Delete** |

States:
- **Empty** — "No recurring rules yet — add one above." / "Add an account first." when none.
- **Notice** — `role="status"`: "Recurring rule created." · "Posted N transactions." · "Nothing
  due right now."
- **Error** — `role="alert"`: server validation (amount, frequency, over-allocated split).
- **Loading** — "Loading…" until rules load.

## 5. Wireframe / layout

```
RECURRING                         [← Dashboard] [Post due]
NEW RECURRING RULE
  Account [Checking ▼]  (•)Withdrawal ( )Deposit  Amount [1500.00]  Payee [Landlord]
  Frequency [monthly ▼]  First date [2026-07-01]
  ALLOCATE … Rent 1500.00         [ Create recurring rule ]
YOUR RECURRING RULES
  Checking  withdrawal  $1,500.00  monthly  next 2026-07-01  up to date  Rent $1,500.00  [Delete]
  Checking  deposit     $2,000.00  biweekly next 2026-06-26  2 due       …               [Delete]
```

## 6. Interactions & inputs

- The split is defined with the **same allocation editor** as a manual transaction (Single /
  Split, refund rows, partial allowed); the editor's Save button **is** "Create recurring rule".
- **Post due** is a single header action that posts every due occurrence across all rules.
- A partially-split rule's generated transactions surface in **Needs allocation** as usual.

## 7. Content & copy

- Buttons: **"Create recurring rule"**, **"Post due"**, **"Delete"**.
- Badges: **"N due"** / **"up to date"**.

## 8. Accessibility

Labeled form ("New recurring rule") and controls (Account, Amount, Frequency, First date);
notices via `role="status"` and errors via `role="alert"` (not color); the rule list is a
labeled `list`; keyboard-operable throughout.

## 9. Acceptance criteria (UX)

- **Given** account + envelope, **when** I create a rule, **then** it lists with its next date
  and (if anchored in the past) a **due** badge.
- **Given** a due rule, **when** I **Post due**, **then** I see "Posted N transactions." and the
  rule flips to "up to date"; posting again says "Nothing due right now."
- **Given** a rule, **when** I **Delete** it, **then** it leaves the list.

## 10. Out of scope / later

Editing a rule in place; pausing / end-dates; auto-posting on load; upcoming-occurrence preview.
