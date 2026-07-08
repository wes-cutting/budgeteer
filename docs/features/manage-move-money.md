<!--
FEAT NOTE — UXR7 (2026-07-06 UX Redesign), §11-compressed: the Manage page's Move-money form
adopts the UXR4 form-layout pattern. Presentation only; smallest item in the track.
-->

# FEAT note — Manage: Move-money form on the form pattern (UXR7)

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Feature ID   | UXR7 (§11-compressed — this note is the spec)                            |
| Status       | Implemented                                                              |
| Owner        | Wesley Cutting                                                           |
| Last updated | 2026-07-07                                                               |
| Related      | [UXR4 form pattern](../ux/templates-page.md) §3 · [FEAT-UX6 manage](manage.md) · `MoveMoneyForm.tsx` |
| Gated by     | UXR4                                                                     |

**What:** `MoveMoneyForm` (From envelope · To envelope · Amount · Memo) re-rendered on the
UXR4 pattern — stacked `Field`s (From/To gridded as a pair, stacking ≤ 640px), action row
with **Move money**, width capped. **Zero behavior change:** the UX12d inline amount
validation, the both-envelopes/different-envelopes checks, the reset-on-success, and the
hide-until-two-active-envelopes rule all carry; the envelope-transfer API call is untouched.

**Proof:** existing `MoveMoneyForm`/`ManageView` tests pass with selectors re-pointed; axe
light + dark on `/manage`; **no new pattern code** (this slice is UXR4-reuse evidence, like
UXR5). Bundle delta ≈ 0.

**Out of scope:** Manage's other content (net-worth summary, links — unchanged); account↔
account transfers (live in the register/TransferForm, not this form); any data/API change.
