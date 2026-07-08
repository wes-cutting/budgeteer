// Inline (field-level) form validation for the web (UX12d). Pure string→message helpers reused
// across the create/transfer/move forms so a field can surface its own error *before* submit,
// instead of failing silently (a greyed-out Save) or only at the server round-trip.
//
// Scope: these catch *format* problems the user can fix by re-typing. Semantic rules (a positive
// amount, sufficient funds, two different envelopes) stay SERVER-authoritative and still surface at
// submit — inline validation is a UX affordance layered on top of the boundary check, never a
// replacement for it (docs/features/inline-validation.md §3).

import { tryParseMoney } from "@budgeteer/domain";

/**
 * Field-level validation for a money-amount input. Returns a user-facing message when the field
 * holds non-empty text that isn't a parseable amount (`tryParseMoney` — the single penny-exact
 * parser, so the inline check can never drift from the boundary one), else `null`.
 *
 * Empty is NOT an error here: emptiness is a required-ness concern the callers gate separately, and
 * flagging a field the user hasn't finished is noise. Callers show the message on blur (once the
 * field is "touched"), so an in-progress "1." never flashes red mid-type.
 */
export function amountFieldError(value: string): string | null {
  if (value.trim() === "") return null;
  return tryParseMoney(value) === null ? "Enter an amount like 12.34." : null;
}
