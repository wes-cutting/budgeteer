---
type: feature-spec
roadmap-item: BUD-S57
---
<!--
FEATURE SPEC — scopes the FOURTH (final) slice of roadmap item UX12 (2026-06-25 UX Uplift, Phase 4
"Polish"). UX12 bundles four independent threads (skeletons · toasts · destructive-action confirms ·
inline validation); per docs/00_WAYS_OF_WORKING.md §5 (vertical, not horizontal) + §11 (right-size /
compress) each ships as its own coherent thread. Thread 1 is docs/features/destructive-confirms.md;
thread 2 is docs/features/skeleton-loaders.md; thread 3 is docs/features/inline-validation.md; this
note is thread 4 — success toasts. Fast-path ceremony: this note IS the spec (small, single-pattern
presentation change on a validated primitive lib — §11). No ADR (ADR-0005 already reserves Radix for
toast); a11y proven axe-clean light + dark before wiring.
-->

# Feature Spec — Success toasts (UX12c)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX12 (thread 4 of 4 — "success toasts")                          |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux12c.md))  |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-02                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX12`) · new Radix primitive per [ADR-0005](../adr/ADR-0005-frontend-design-system.md) (reserves Radix for the hard a11y widgets — toast is one) · sibling threads [FEAT-UX12a](destructive-confirms.md) · [FEAT-UX12b](skeleton-loaders.md) · [FEAT-UX12d](inline-validation.md) |

## 1. Summary

Every successful mutation was **silent**. You created an account, transferred money, moved budgeted
money, archived an envelope, or deleted a template and the only feedback was the list quietly
re-rendering — and the global quick-add even **navigates away** on save, so it confirmed nothing at
all. This slice adds a **transient, auto-dismissing success toast** so a mutation visibly *lands*.

A new **`ToastProvider` / `useToast()`** pair (`apps/web/src/ui/Toast.tsx`) wraps the app; a call site
fires `showToast("Account created")` on success. It is built on **`@radix-ui/react-toast`** — the last
of the "hard interactive a11y widgets" ADR-0005 reserved for Radix — so it inherits the announce
contract rather than hand-rolling a live region.

## 2. Scope — the last UX12 thread, and the only one needing a dependency

| Thread | Status after this slice |
| ------ | ----------------------- |
| Confirm on destructive actions | ✅ UX12a |
| Skeleton loaders | ✅ UX12b |
| Inline validation (money-amount fields) | ✅ UX12d |
| **Success toasts** | **✅ this slice (UX12c)** |

**Call sites wired (the successful-mutation set):** create **account** (`AccountsList`), create
**envelope** (`EnvelopesList`), create **transaction** (register `AccountRegister` **and** global
quick-add `QuickAddTransaction`), **transfer** (`AccountRegister`), **move money** (`ManageView`),
**archive** account/envelope (`AccountsList`/`EnvelopesList`), **delete** template (`TemplatesView`).
Each fires from the existing success path (the `onCreated`/`onTransferred`/`onMoved` callback or the
archive/delete handler's success branch) — **no data/API/domain/chart change**.

**Deliberately out of scope:** error toasts (failures already surface an inline `role="alert"` at the
call site — unchanged) and toasts for rename/reconcile/post-due (rename is inline; reconcile/post-due
already render their own `role="status"` notice in-view).

## 3. Design — a `ToastProvider` + `useToast()` on Radix Toast

- **`ToastProvider`** (`ui/Toast.tsx`) wraps `@radix-ui/react-toast`'s `Provider` + `Viewport` and
  holds a small queue of `{ id, message }` in state. It is mounted **at the app root** (`App.tsx`,
  wrapping `RouterProvider` — **not** a route) so a toast **survives navigation**: the quick-add
  navigates away on save, and the toast lives above it.
- **`useToast()` → `{ showToast }`.** Rendered **without** a provider (a view mounted in isolation by a
  unit test), `showToast` is a **silent no-op** rather than a throw — a toast is an *auxiliary* success
  affordance, mirroring the "auxiliary UI degrades rather than breaks" pattern already used for the
  shell's needs-allocation badge. Tests that assert a toast wrap the view in `<ToastProvider>`.
- **A11y (the headline risk — an auto-dismissing, animated, live-region toast):**
  - **Announce:** Radix mirrors each toast into a live region with **`role="status"` + `aria-live="polite"`** (we use `type="background"`, **never** foreground / `role="alert"`) — a routine success
    confirmation announces without interrupting the screen-reader user.
  - **Motion:** the entrance is **transform-only** (a slide, `Toast.module.css`) — **no text-opacity
    fade** (that tripped the UX3 route-fade contrast gate) — and the global `prefers-reduced-motion`
    reset (`base.css`) zeroes it, so it is reduced-motion-safe.
  - **Dismiss:** an explicit **Dismiss** button, plus Radix's swipe/ESC; auto-dismiss after 5s.
  - **State never rests on colour:** the message **text** carries it; the `--color-success` accent is a
    decorative 4px border only. Panel is `--color-surface`/`--color-text` (clears AA light + dark).
- **No ADR / no spike report:** ADR-0005 already reserves Radix for toast; this is the validated,
  well-understood additive pattern. The a11y risk was retired **before wiring** by proving the toast
  **axe-clean light AND dark with it visible** (`e2e/a11y.spec.ts`, both schemes). §11 fast-path — this
  note is the paperwork.

## 4. A11y coverage

`e2e/a11y.spec.ts` fires a real mutation's toast and axe-scans it **visible**, in **light AND dark** —
exercising the live-region announce, the transform-only entrance, and the panel contrast. The
primitive is unit-tested for its contract (announces via **`role="status"`/polite**, is **not**
`role="alert"`, the Dismiss affordance removes it, and it no-ops without a provider). Introducing an
app-wide `role="status"` live region made the pre-existing **bare** `getByRole("status")` selectors in
the reconcile/recurring e2e ambiguous; those three assertions are **scoped to their view's notice** in
the same change.

> **Test-env note (not a product bug):** in headless Playwright the window is unfocused, so Radix
> **pauses** each toast's auto-dismiss timer — toasts linger for the run. Real usage (focused window)
> dismisses them at 5s. Selectors are scoped so this is inert.

## 5. Acceptance criteria

1. Each successful mutation in the wired set fires a transient success toast. ✅ (unit + e2e)
2. The toast announces via **`role="status"` (polite), never `role="alert"`**, and carries a Dismiss
   affordance. ✅ (`Toast.test.tsx` + `e2e/toasts.spec.ts`)
3. Reduced-motion-safe (transform-only entrance, zeroed by the global reset); state never rests on
   colour. ✅ (design; a11y scan)
4. **Axe-clean light + dark with the toast visible.** ✅ (`e2e/a11y.spec.ts`, both schemes)
5. Gate green; bundle within budget. ✅ (354 Vitest passing + 89 e2e; **116.31 KB gz** < 120 KB,
   ~3.7 KB headroom — the Radix Toast is the real add, +4.63 KB).
