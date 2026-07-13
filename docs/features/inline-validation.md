---
type: feature-spec
roadmap-item: BUD-S57
---
<!--
FEATURE SPEC — scopes the THIRD slice of roadmap item UX12 (2026-06-25 UX Uplift, Phase 4 "Polish").
UX12 bundles four independent threads (skeletons · toasts · destructive-action confirms · inline
validation); per docs/00_WAYS_OF_WORKING.md §5 (vertical, not horizontal) + §11 (right-size / compress)
each ships as its own coherent thread. Thread 1 is docs/features/destructive-confirms.md; thread 2 is
docs/features/skeleton-loaders.md; this note is thread 3 — inline validation. Fast-path ceremony:
this note IS the spec (small, single-pattern presentation change — §11). No ADR / no spike.
-->

# Feature Spec — Inline validation (UX12d)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX12 (thread 3 of 4 — "inline validation")                       |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux12d.md))  |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-02                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX12`) · reuses `tryParseMoney` from [`@budgeteer/domain`](../../packages/domain/src/money.ts) · sibling threads [FEAT-UX12a](destructive-confirms.md) · [FEAT-UX12b](skeleton-loaders.md) |

## 1. Summary

Money-amount inputs failed **invisibly**. Type `abc` or `12,00` into an amount field and the app
gave no field-level explanation:

- The **quick-add / register transaction amount** silently drops `AllocationEditor`'s
  `magnitudeCents` to `0`, which just **greys out Save** with no stated reason.
- **Transfer**, **move-money**, and **add-account (starting balance)** instead let the *server*
  reject at submit — a round-trip that surfaces a generic message only after the click.

This slice surfaces a **field-level validation message** the moment an amount can't parse. A new
`amountFieldError` helper (reusing the single penny-exact parser, `tryParseMoney`, so the inline
check can never drift from the boundary one) drives a new **`FieldError`** primitive: the input gets
`aria-invalid` + `aria-describedby`, and a short, format-showing message ("Enter an amount like
12.34.") renders beside it. Submit is also guarded client-side so a known-bad amount never
round-trips.

## 2. Scope — why this thread, and only this thread

The **lower-risk** remaining UX12 thread (the owner picked it over success toasts, 2026-07-02): it
reuses existing primitives and the existing pure parser — **no new dependency, no ADR, negligible
bundle** — and touches **no data / API / domain / chart**. It is deliberately narrowed to the one
failure that is genuinely *silent* today: an **un-parseable money amount**.

| Thread | Status after this slice |
| ------ | ----------------------- |
| Confirm on destructive actions | ✅ UX12a |
| Skeleton loaders | ✅ UX12b |
| **Inline validation (money-amount fields)** | **✅ this slice (UX12d)** |
| Success toasts | ✅ shipped — [FEAT-UX12c](success-toasts.md) |

**Deliberately out of scope (tracked follow-ons):** required-field inline messaging (blank `Name` /
unpicked select) — these already surface *something* at submit, so they are a weaker case than the
silent amount failure; and migrating these bare-`<label>` forms onto the `Field`/`Input` primitives
(a broader restyle, not a validation change). Semantic money rules (a **positive** amount, sufficient
funds, two **different** envelopes) stay **server-authoritative** and still surface at submit — inline
validation is a UX affordance layered on the boundary check, never a replacement for it (the
"validate at the boundary; invalid input fails loudly" rule is unchanged).

## 3. Design — an `amountFieldError` helper + a `FieldError` primitive

- **`amountFieldError(value)`** (`apps/web/src/validation.ts`) — pure `string → string | null`.
  Returns the message when `value` is non-empty and `tryParseMoney(value) === null`, else `null`.
  **Empty is not an error** (required-ness is gated separately); the message is only shown once the
  field is **touched** (on blur), so an in-progress `1.` never flashes red mid-type, then updates
  live so it clears as the user corrects it.
- **`FieldError`** (`apps/web/src/ui/Feedback.tsx`) — the quiet, field-scoped counterpart to the
  assertive whole-form `Alert`. A `<span id={…}>` the input points `aria-describedby` at (a
  **description, not a live region** — so it doesn't re-announce on every keystroke); the input pairs
  it with `aria-invalid`. Styled `--color-danger` (~6.5:1 on bg + surface, light **and** dark) at
  `--text-sm` — but the state is carried by the **message text**, never colour alone.
- **Call sites (4):** `AddTransactionForm` (transaction amount) · `TransferForm` (amount) ·
  `MoveMoneyForm` (amount) · `AddAccountForm` in `AccountsList` (starting balance). Each: a `touched`
  flag set on blur, the `aria-invalid`/`aria-describedby` wiring, the `FieldError`, and (for the three
  submit-driven forms) a guard that sets `touched` + returns before the API call. `AddTransactionForm`
  needs no submit guard — the editor's Save is already disabled on an unparseable amount; the message
  now explains *why*.

- **No ADR / no spike:** additive UI reusing an existing pure parser + design-system primitives; **no
  dependency**, no data/API/domain/chart change. §11 fast-path — this note is the paperwork.

## 4. A11y coverage

Every existing `aria-label` / `<label>` association is **preserved** (the e2e/unit suites select by
label text) — this slice only *adds* `aria-invalid` + `aria-describedby` + the message. `FieldError`
is unit-tested for its contract (carries the `id`; is **not** `role="alert"`). `e2e/a11y.spec.ts`
scans the Add-account form with an amount error **visible** — exercising the invalid-field
association and the `--color-danger` message contrast — in **light AND dark**.

## 5. Acceptance criteria

1. An un-parseable amount in any of the four forms shows a field-level message and marks the input
   `aria-invalid` + `aria-describedby`. ✅ (unit + e2e)
2. The three submit-driven forms **block the mutation** on a known-bad amount (no round-trip); fixing
   it clears the error live and lets the action through. ✅ (unit + e2e)
3. Empty is not flagged; an in-progress value isn't flagged until blur. ✅ (`amountFieldError` unit)
4. State never rests on colour — the message text carries it; axe-clean **light + dark** with the
   error visible. ✅ (`e2e/a11y.spec.ts`, both schemes)
5. Gate green; bundle within budget. ✅ (349 Vitest passing + 86 e2e; **111.68 KB gz** < 120 KB)
