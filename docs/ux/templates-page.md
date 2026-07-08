<!--
UX SPEC — UXR4 (2026-07-06 UX Redesign): the Templates page — saved-templates table + the
template editor re-organized. THIS SPEC ALSO DEFINES THE FORM-LAYOUT PATTERN (§3) that UXR5
(Recurring) and UXR7 (Manage) reuse — it is specced once, here, and referenced.
Initiative brief: reviews/2026-07-06-ux-redesign-initiative.md.
-->

# UX Spec — Templates page (+ the form-layout pattern)

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Status       | Proposed                                                                 |
| Feature      | UXR4 (presentation-only; §11 compression — build detail here)            |
| Owner        | Wesley Cutting                                                           |
| Last updated | 2026-07-07                                                               |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · [FEAT-004 templates](../features/templates.md) (behavior, unchanged) · pattern consumers: [UXR5](recurring-page.md) · [UXR7](../features/manage-move-money.md) |
| Gated by     | UXR1 (chrome) · UXR8 (demo data to design against — owner has none)      |

## 1. User & job

Create and maintain reusable split templates. Today the editor is unstyled inline controls
glued by whitespace, and the saved list is a text run
(`name · N lines · $total · Rename · Delete`). The owner's ask: table the list, organize the
form.

## 2. Saved-templates table

| Columns | Row actions (carried) |
| ------- | --------------------- |
| Name · Lines (count) · Total | Rename (inline, carried) · Delete (keeps the UX12 `ConfirmDialog`) |

States carried: `Skeleton` loading · empty **"No templates yet — save a split to reuse it."**
· `role="alert"` error. Money right-aligned/monospaced; `.table-scroll` reflow; axe
light+dark.

## 3. The form-layout pattern (defined here; reused by UXR5 · UXR7)

The app's forms currently render as bare `label + input` runs. The pattern, built from the
existing UX4 primitives (`Field`, `FieldError`, tokens — **no new dependency**):

1. **Stacked fields** — label above control (the `Field` primitive everywhere; no
   whitespace-glued inline labels). Related fields sit in a responsive grid row where natural
   (e.g. Kind + Amount), stacking ≤ 640px.
2. **Grouped sections** — multi-part forms use `<fieldset>` + visible `<legend>` per group.
3. **Line editors** (the multi-row envelope/amount case) — a labeled mini-grid: column
   headers (Envelope · Amount · remove), aligned rows, amount inputs right-aligned/monospaced,
   **"+ Add line"** beneath the rows.
4. **Action row** — right-aligned, primary action rightmost; destructive actions are never
   the primary; submitting disables (carried).
5. **Errors** — field-level via `FieldError` under the control (the UX12d convention);
   form-level failures as the existing `role="alert"` above the action row.
6. **Width** — forms cap at a comfortable measure (~40–48rem) instead of stretching the
   canvas.

## 4. The template editor, on the pattern

- **Section "New template"** (fieldset): Name field; the lines mini-grid (envelope select ·
  amount · per-row remove with its carried accessible name); "+ Add line"; action row with
  **Save template**.
- Behavior unchanged: blank/zero lines filtered on save; form resets after create; inline
  rename and confirmed delete in the table.

## 5. Accessibility

Labels stay programmatically tied (the `Field` primitive); the lines grid keeps per-row
accessible names ("Template envelope 2", "Remove line 2"); fieldset/legend announce the
grouping; keyboard order = visual order; axe light AND dark; 320px reflow.

## 6. Acceptance criteria (UX)

- Saved templates render as the §2 table; rename + confirmed delete work as today (existing
  tests re-pointed, no flow rewritten).
- The editor renders on the §3 pattern — every control labeled via `Field`, lines as the
  mini-grid, actions right-aligned; create/reset behavior byte-for-byte equivalent.
- The §3 pattern is reusable as built (UXR5/UXR7 restyle **without** new pattern code).
- Empty/loading/error per §2; axe light+dark; 320px reflow.

## 7. Out of scope

Template behavior changes (fixed-amount lines stay per FEAT-004) · applying templates (lives
in the allocation editor, untouched) · any data/API change.
