<!--
UX SPEC — UXR5 (2026-07-06 UX Redesign): the Recurring page — rule forms onto the UXR4
form-layout pattern, and the rules list re-formatted for readability. Behavior (FEAT-009)
unchanged except one flagged consistency addition (§4). Initiative brief:
reviews/2026-07-06-ux-redesign-initiative.md.
-->

# UX Spec — Recurring page

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Status       | Implemented                                                              |
| Feature      | UXR5 (presentation + one flagged consistency change; §11 compression)    |
| Owner        | Wesley Cutting                                                           |
| Last updated | 2026-07-07                                                               |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · [FEAT-009 recurring](../features/recurring.md) (behavior) · reuses the [UXR4 form pattern](templates-page.md) |
| Gated by     | UXR4 (the pattern must exist first)                                      |

## 1. User & job

Define scheduled transactions (rules carry their own split) and post what's due. The owner's
ask: the forms lack formatting, and the rules list — today one text run per rule
(`account · direction · amount · frequency · next date · due-status · the whole split joined
by commas · Delete`) — is hard to read.

## 2. The rules table

| Columns | Notes |
| ------- | ----- |
| Payee · Account · Amount (signed) · Frequency · Next date · Status · Actions | Status = the carried text pair: **"N due"** / **"Up to date"**. Actions = **Delete** (see §4). |

- **The split moves out of the row** — the readability fix. Each row carries a disclosure
  ("N lines", a real button, `aria-expanded`) that expands an indented detail region listing
  the rule's lines: envelope · amount · refund marker. Collapsed by default; state
  per-row, not persisted.
- **Payee becomes a column** — the rule's own identifying field, captured at creation but not
  shown in today's list (rows read as "Checking withdrawal $-870.00…"). Rules without a payee
  show "—". *Presentation of existing data, no schema change — flagged as the one column the
  current list doesn't render; **owner-ratified 2026-07-07**.*
- Money signed + monospaced; `.table-scroll` reflow; axe light+dark.
- **Post due** stays a single global action in the page header (unchanged — it is not
  per-row).

## 3. The forms, on the UXR4 pattern

- **Section "New recurring rule"** (fieldset): Account · Type (Deposit/Withdrawal radiogroup,
  carried) · Amount · Payee · Frequency · First date — stacked `Field`s, natural pairs
  gridded (Amount+Payee, Frequency+First date), stacking ≤ 640px.
- The **AllocationEditor** (the rule's split) renders inside a labeled group beneath —
  the editor itself is shared and **unchanged**; only its framing adopts the pattern.
- Errors per the pattern (field-level `FieldError`; form-level `role="alert"`); the
  post-due `role="status"` notices carry.

## 4. One flagged behavior addition (owner-ratified 2026-07-07)

**Rule delete gains the UX12 `ConfirmDialog`.** Today it deletes on one click — templates,
archives, and every other destructive action confirm (the UX12 convention); a rule is
non-trivial to reconstruct (schedule + split). Copy: *"Delete this rule? Generated
transactions are kept; the schedule stops. This can't be undone."* Strictly a consistency
catch-up. **Ratified by the owner 2026-07-07** — ships with the slice.

## 5. States

Carried: `Skeleton` loading · empty **"No recurring rules yet — add one above."** ·
`role="alert"` error · the "Add an account first." no-accounts gate on the form.

## 6. Accessibility

Disclosure buttons named per rule ("Show 3 lines for <payee>", `aria-expanded`); radiogroup
carried; labels via `Field`; table `<th>` semantics; keyboard order = visual order; axe light
AND dark; 320px reflow.

## 7. Acceptance criteria (UX)

- Rules render as the §2 table; the split appears only via the disclosure and lists every
  line incl. refund markers; Payee shows (or "—").
- The form renders on the UXR4 pattern with **zero pattern code added** (reuse proves UXR4).
- Post due, creation, and deletion flows byte-for-byte equivalent — except delete now
  confirms (§4, owner-ratified); existing tests re-pointed, +1 confirm assertion.
- States per §5; axe light+dark; 320px reflow.

## 8. Out of scope

Rule editing (doesn't exist today — a rule is delete-and-recreate; adding edit would be a
feature, not formatting) · per-rule posting · schedule changes · any data/API change.

## 9. As built (2026-07-07)

Built presentation-only over the existing recurring reads/flows —
[`RecurringView.tsx`](../../apps/web/src/RecurringView.tsx) — plus the two owner-ratified
additions (§2 Payee column · §4 delete confirm).

- **The form on the UXR4 pattern (§3)** — the rule form imports the shared
  [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css): a `<fieldset>`+visible
  `<legend>New recurring rule>`, every control via the UX4 `Field`/`Input`/`Select` primitives
  (stacked label→control), the carried Deposit/Withdrawal radiogroup unchanged, and the natural
  pairs **gridded** (Amount+Payee · Frequency+First date), stacking ≤ 640px. The shared
  **AllocationEditor** (the rule's split, with its own "Create recurring rule" submit) is
  **unchanged** — it renders in the capped group beneath, only its framing adopts the pattern.
  Create/reset behavior is byte-for-byte (blank/zero lines filtered by the editor; payee trimmed to
  `undefined` when empty; form resets after create).
- **One pattern-completing addition (reconciles §7's "zero pattern code").** §3.1 always specified
  responsive gridded field-pairs, but UXR4's Templates form had none, so the shared module never
  realized a pair-row. UXR5 is the first consumer that needs it, so it lands a single
  `.fieldRow` class in `FormLayout.module.css` (responsive two-column grid, stacks ≤ 640px) — the
  pattern realizing its own §3.1, now reused by UXR7 — rather than fragmenting it into page-local
  CSS or dropping the gridded layout §3 calls for. This is the **only** pattern code the slice
  added; the table treatment and every other form control reuse existing classes verbatim.
- **The rules list → a table (§2)** on the shared UXR3 treatment
  ([`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css), reused verbatim): **Payee** (`<th
  scope="row">`, "—" when absent) · **Account** · **Amount** (signed by direction, right-aligned
  tabular) · **Frequency** · **Next date** · **Status** ("N due" / "Up to date") · **Split** · **Actions**,
  in the global `.table-scroll` focusable region with an `sr-only <caption>`. **Payee is surfaced**
  (data the old list never rendered). The **split moved out of the row** into a per-row disclosure
  (a real `<button aria-expanded aria-controls>`, named "Show N lines for {payee-or-account}") that
  reveals an indented detail region — an `<ul>` in a `colSpan` row listing each line's envelope ·
  amount · refund marker. Collapsed by default, state per-row (a `Set`), not persisted. The
  disclosure's small local styling lives in
  [`RecurringView.module.css`](../../apps/web/src/RecurringView.module.css) (page-local, not pattern
  or treatment code).
- **Delete confirm (§4)** — Delete now opens the UX12 `ConfirmDialog` (title "Delete this rule?",
  the §4 copy) instead of deleting on one click; per-row action name "Delete {payee-or-account}".
  **Post due** stays the single global header action.
- **A11y:** `<th>` scope semantics; per-row disclosure + action names; the form's fieldset/legend +
  `Field` associations; keyboard order = visual order; the table in `.table-scroll` (320px reflow);
  **axe light AND dark** gate the table + its EXPANDED split detail + the form (`a11y.spec` seeds a
  rule and expands its disclosure, in both schemes — mirrors `scanTemplates`).
- **Test note (pre-existing race hardened in passing):** the a11y suite's `openPayPeriodsFor` helper
  selected the pay-periods account before its default-account plan had settled — a controlled-`<select>`
  race that this slice's two extra seeding tests widened (larger shared store → slower default plan)
  into 4 deterministic pay-periods failures. Fixed in the helper by waiting for the default plan
  (planner or empty state) before selecting; no app logic changed. See the status report §4.
