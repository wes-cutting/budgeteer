---
type: feature-spec
roadmap-item: BUD-S9
status: Implemented
---
<!--
FEATURE SPEC — #9: recurring transactions. A rule (account + direction + amount + split +
schedule) and an idempotent "Post due" generator over the existing txn model. Pairs with
docs/ux/recurring.md.
-->

# Feature Spec — Recurring transactions

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-009                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-14                             |
| Related      | [Transactions](transactions.md) (FEAT-003) · [Templates](templates.md) (FEAT-004) · [UX](../ux/recurring.md) · [Domain](../04_DOMAIN_MODEL.md) · [Data](../05_DATA_MODEL.md) · [API](../06_API_CONTRACT.md) |

## 1. Summary

Define a **recurring rule** — an account, a direction + fixed amount, an optional payee/memo, a
**split** (allocation lines), and a **schedule** (weekly / biweekly / monthly anchored on a
date) — then **Post due** to generate the concrete transactions that have come due. Generation
is **idempotent**: each rule carries a `next occurrence` cursor that advances as occurrences are
posted, so re-running posts nothing already posted and no background worker is needed. Generated
transactions are ordinary transactions (they show in the register, count toward balances, and —
if the split under-allocates — appear in **needs-allocation**).

## 2. Scope

- **In scope** — create a rule (with its split); list rules with their **next date** + **due
  count**; **Post due** (catch up every occurrence on/before today, advancing the cursor);
  delete a rule (generated history is preserved).
- **Out of scope** — editing a rule in place (delete + recreate for now); variable amounts
  (fixed per rule; edit the generated txn if it differs); pausing a rule; end-date / occurrence
  caps; auto-posting on app load (explicit Post due is the V1 trigger); reminders/notifications.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want my biweekly paycheck and monthly bills defined once so I don't re-enter them. | Must |
| US-2 | As the user, I want one click to post everything that's come due, caught up to today. | Must |
| US-3 | As the user, I want posting to be safe to repeat (no duplicates). | Must |
| US-4 | As the user, I want a generated paycheck pre-split across my envelopes. | Should |
| US-5 | As the user, I want to delete a rule without losing the transactions it already created. | Should |

## 4. Acceptance criteria

- **Given** a weekly rule anchored in the past, **when** I **Post due**, **then** one
  transaction is created per missed occurrence up to today, each with the rule's split, and the
  account/envelope balances reflect them.
- **Given** I just posted, **when** I **Post due** again, **then** nothing is created (the
  cursor is parked in the future) and balances are unchanged.
- **Given** a rule whose split is partial, **when** it generates, **then** the transaction
  appears in **needs-allocation** with the right remainder.
- **Given** a future anchor, **when** I view the rule, **then** its **due count** is `0` and
  Post due creates nothing.
- **Given** a rule, **when** I delete it, **then** it's removed but its already-generated
  transactions remain (their `recurring_id` is nulled).
- **Invalid** input — bad frequency, missing account, no split lines, or an over-allocated /
  net-flipped split — is rejected (`400` / `404`).

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Monthly anchored on the 31st | Each occurrence lands on the 31st, **clamped** to short months (Feb 28/29) — clamped off the **anchor** day, so it returns to 31 in long months. |
| Long-dormant rule (many missed periods) | Post due catches up all of them in one atomic write per rule (capped defensively at ~600 occurrences). |
| A rule's envelope was archived after creation | That rule's Post due fails and is reported per-rule; other rules still post (per-rule atomicity). |
| Refund line in a rule's split | Supported — generated txns carry the signed (refund) row, same as a manual split (FEAT-008). |

## 6. Data changes

New tables ([05_DATA_MODEL](../05_DATA_MODEL.md)): **`recurring_transactions`** (rule + schedule
cursor `next_occurrence_on`) and **`recurring_lines`** (the split: positive magnitude + `refund`
+ position). `transactions` gains a nullable **`recurring_id`** FK (**on delete set null** — keep
generated history when a rule is deleted) + index. No change to balance views (generated rows are
normal transactions/allocations).

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):
- `GET /recurring` → rules with `nextOccurrenceOn`, `dueCount`, and `lines`.
- `POST /recurring` `{ accountId, kind, amount, payee?, memo?, frequency, anchorOn, lines:[{envelopeId, amount, refund?}] }` → `201`.
- `DELETE /recurring/:id` → `204`.
- `POST /recurring/post-due` → `200 { result: { posted, rules } }`.

`TransactionView` gains `recurringId`. UI: a **Recurring** page (reached from the Dashboard) with
a create form (reusing the split editor), a **Post due** button, and the rule list with delete
(see [UX](../ux/recurring.md)).

## 8. Dependencies

FEAT-003 (transactions + allocations + `validateAllocations`); the pure `recurring.ts` schedule
core (weekly/biweekly/monthly + `dueOccurrences`). No external scheduler.

## 9. Security, privacy & accessibility

Household-scoped; account + envelopes validated at creation **and** defensively at post time
(archived/unknown → the rule's post fails, reported per-rule). Amounts validated positive at the
boundary; the generated split obeys the same signed-total invariant. The Recurring form and list
use labeled controls; status via `role="status"`/`role="alert"`, not color.

## 10. Test plan

- **Unit (domain):** `nextOccurrence` (weekly/biweekly + monthly anchor-day clamp 31→28→31);
  `dueOccurrences` (catch-up, on-today inclusive, future = none) ([recurring.test.ts](../../packages/domain/test/recurring.test.ts)).
- **Integration (API):** create (cursor=anchor, due count); post-due generates N + sets the
  split + is idempotent; partial split → needs-allocation; validation 400/404; delete keeps
  history.
- **Component (web):** create a rule → it lists with due count; Post due shows "Posted N" and
  flips to up-to-date; re-post shows "Nothing due"; delete empties the list.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Edit a rule in place (vs. delete + recreate)? | Wesley | open (V1: delete + recreate) |
| Pause a rule / end-date / occurrence cap? | Wesley | open (later) |
| Auto-post due on app load (vs. explicit button)? | Wesley | open (V1: explicit) |
