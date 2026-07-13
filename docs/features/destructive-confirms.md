---
type: feature-spec
roadmap-item: BUD-S57
---
<!--
FEATURE SPEC — scopes the FIRST slice of roadmap item UX12 (2026-06-25 UX Uplift, Phase 4 "Polish").
UX12 as written bundles four independent threads (skeletons · toasts · destructive-action confirms ·
inline validation); per docs/00_WAYS_OF_WORKING.md §5 (vertical, not horizontal) + §11 (right-size /
compress) this slice ships ONE coherent thread — confirmation on destructive actions — and leaves the
other three tracked as follow-on sub-slices (none dropped). Fast-path ceremony: this note IS the UX
spec (small, single-surface pattern — §11). Status ladder: §4.
-->

# Feature Spec — Destructive-action confirmation (UX12a)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX12 (thread 1 of 4 — "confirm on destructive actions")          |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux12.md))   |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-02                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX12`) · reuses the Radix `Dialog` primitive from [FEAT-UX7](quick-add-transaction.md) (per [ADR-0005](../adr/ADR-0005-frontend-design-system.md)) · [archive-envelope UX](../ux/archive-envelope.md) |

## 1. Summary

Three management actions were **one-click, no-confirm** — a stray click archived an account/envelope
or **permanently deleted** a template with no chance to reconsider. This slice interposes a
**confirmation dialog** before each:

- **Archive envelope** (`/envelopes`) — reversible (Unarchive), but it drops the envelope out of the
  active list **and** out of this month's budget, so a pause is warranted.
- **Archive account** (`/accounts`) — reversible, but hides the account from the active list.
- **Delete template** (`/templates`) — **irreversible** (no unarchive for templates); the strongest
  case for a confirm.

Owner decision (2026-07-02): **all three get a consistent blocking confirm** (not just the
irreversible Delete) — predictable behaviour, matches the brief's "Archive/Delete" wording.

## 2. Scope — why this thread, and only this thread

UX12 bundles four polish threads. Doing all four at once would be a horizontal "polish layer"
(against *vertical, not horizontal*, §5). This slice is the **safety/correctness** thread — the only
one about preventing data loss rather than cosmetics — and it **reuses an already-validated
primitive**, so it is a tight, low-risk vertical. The other three threads stay tracked:

| Thread | Status after this slice |
| ------ | ----------------------- |
| **Confirm on destructive actions** | ✅ this slice (UX12a) |
| Skeleton loaders (replace bare `Loading…`) | ✅ shipped — [FEAT-UX12b](skeleton-loaders.md) |
| Inline validation surfaces | ✅ shipped — [FEAT-UX12d](inline-validation.md) |
| Success toasts | ✅ shipped — [FEAT-UX12c](success-toasts.md) |

## 3. Design — a `ConfirmDialog` primitive on the validated Radix `Dialog`

New primitive `apps/web/src/ui/ConfirmDialog.tsx`, built on the **same `@radix-ui/react-dialog`** the
quick-add modal uses (ADR-0005; SPIKE-06 validated it axe-clean light + dark). It differs from the
existing `Dialog` only in **lifecycle**: `Dialog` is route-driven (hard-`open` while its route is
mounted); `ConfirmDialog` is **controlled + transient** (`open` prop toggled by a row click, closes
on confirm/cancel). It reuses `Dialog.module.css` (adds one `.actions` row), so light/dark fall out
of the token sheet and there is **no entrance animation** → reduced-motion-safe by construction.

- **No ADR / no spike:** reuses a validated primitive, adds **no dependency**, touches **no
  data/API/domain** and **no chart primitive** — a well-understood additive UI pattern. Compressed
  ceremony per §11 (this note is the paperwork).
- **State is never carried by colour** (a11y non-negotiable): the confirm button uses the `danger`
  variant for *emphasis*, but the action word ("Archive" / "Delete") **and** the dialog
  title/description name the action independently. Radix auto-focuses the first tabbable element —
  **Cancel is first in DOM order**, so the safe choice is focused by default on a destructive prompt.
- **Dismissal = cancel:** ESC / overlay-click route to `onCancel`; the destructive action runs
  **only** on the explicit confirm button.

Each call site captures the pending row in local state (`pendingArchive` / `pendingDelete`) so the
dialog can name the entity; on confirm it invokes the existing archive/delete handler unchanged.

## 4. UX states (this note is the UX spec — §11)

| State | Behaviour |
| ----- | --------- |
| Trigger | Row's Archive/Delete button no longer mutates directly — it opens the confirm dialog (`role="dialog"`, focus-trapped, named by its title). |
| Confirm | Runs the existing archive/delete handler, closes the dialog; the list updates as before (envelope/account → Archived; template → gone). |
| Cancel / ESC / overlay | Closes the dialog, **no mutation**; focus restores to the trigger. |
| Error | Unchanged — the underlying handler still surfaces its inline `role="alert"` on failure (the dialog has already closed). |

Loading/empty/success states of the underlying lists are unchanged by this slice.

## 5. Acceptance criteria

1. Archiving an envelope, archiving an account, and deleting a template each **open a confirm dialog
   first**; the action runs **only** on confirm. ✅ (unit + e2e)
2. **Cancel** (and ESC) dismisses without mutating. ✅ (unit)
3. The dialog is `role="dialog"`, named by its title, focus-trapped, and **axe-clean light + dark**
   with it open. ✅ (`e2e/a11y.spec.ts`, both schemes)
4. State never rests on colour — the action word + title carry it. ✅
5. Gate green; bundle within budget. ✅ (340 Vitest passing + 83 e2e; 111.48 KB gz < 120 KB)
