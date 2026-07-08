<!--
FEATURE SPEC — scopes the SECOND slice of roadmap item UX12 (2026-06-25 UX Uplift, Phase 4 "Polish").
UX12 bundles four independent threads (skeletons · toasts · destructive-action confirms · inline
validation); per docs/00_WAYS_OF_WORKING.md §5 (vertical, not horizontal) + §11 (right-size / compress)
each ships as its own coherent thread. Thread 1 (destructive confirms) is docs/features/destructive-confirms.md;
this note is thread 2 — skeleton loaders. Fast-path ceremony: this note IS the spec (small, single-
primitive presentation swap — §11). No ADR / no spike.
-->

# Feature Spec — Skeleton loaders (UX12b)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX12 (thread 2 of 4 — "skeleton loaders")                        |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux12b.md))  |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-02                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX12`) · reuses the `Skeleton` primitive from [FEAT-UX4](design-system.md) · sibling thread [FEAT-UX12 destructive-confirms](destructive-confirms.md) |

## 1. Summary

Sixteen views showed a bare `<p>Loading…</p>` (or `<p role="status">Loading…</p>`) during their
initial async read. This slice replaces every one with the existing **`Skeleton`** primitive
(`apps/web/src/ui/Feedback.tsx`) — the same placeholder the home `Cockpit` already uses. A skeleton
communicates "content is coming, here's its rough shape" rather than a bald word, and (because the
primitive owns the announce) it is **accessible by construction**: decorative bars are `aria-hidden`,
and an sr-only `role="status"` politely announces "Loading…".

This is a **net accessibility improvement**: the ~9 sites that used a bare `<p>Loading…</p>` (no live
region) previously announced **nothing** to assistive tech; they now announce politely like the rest.

## 2. Scope — why this thread, and only this thread

The **lowest-risk** remaining UX12 thread: it reuses an **already-validated primitive** (no new
component, **no new dependency**, **no bundle growth** — 111.44 KB gz, actually a hair *below* the
pre-slice 111.48 KB as literal strings drop out), and touches **no data / API / domain / chart**. A
pure presentation swap across the loading branch of each view.

| Thread | Status after this slice |
| ------ | ----------------------- |
| Confirm on destructive actions | ✅ UX12a |
| **Skeleton loaders** | **✅ this slice (UX12b)** |
| Success toasts | Deferred — needs a new Radix Toast primitive (UX12c) |
| Inline validation surfaces | Deferred — follow-on (UX12d) |

## 3. Design — swap the loading branch to `<Skeleton />`

Each view's loading branch (`data === null` / `=== undefined`) now renders `<Skeleton />` (the
default 3 decorative rows, matching `Cockpit`'s usage) instead of a bare paragraph. No row-count
tuning per site: the skeleton is a generic placeholder, not a per-screen layout mock, and consistency
across the app is the goal. No motion is added (the primitive has no entrance animation) → it is
**reduced-motion-safe by construction**; light/dark fall out of the token sheet.

**Sites (16):** `EnvelopesList` · `AccountsList` · `ManageView` (net-worth summary) · `TemplatesView`
· `NeedsAllocation` · `EnvelopeLedger` · `EnvelopeLedgerRoute` · `RecurringView` · and the eight
Insights views (`BudgetVsActualView` · `AnalysisView` · `SpendingBreakdownView` · `SpendingTrendsView`
· `NetWorthView` · `BudgetBurndownView` · `PayoffView` · `CreditView`).

- **No ADR / no spike:** reuses a UX4 primitive already axe-validated in `Cockpit`; additive
  presentation only. §11 fast-path — this note is the paperwork.

## 4. A11y coverage

The `Skeleton` primitive is already unit-tested for its accessible contract (`ui/ui.test.tsx`:
`role="status"` announces "Loading…"; decorative bars are `aria-hidden`) and is already exercised in
the **light + dark** e2e axe suite via the home `Cockpit`. Because the skeleton is **transient** (it
only paints while a read is in flight), catching it live in Playwright is racy; per §11 we rely on the
primitive's existing axe validation rather than adding a flaky delayed-route scan. New **unit** tests
assert the accessible loading state at three representative sites (early-return list pattern +
Insights `role="status"` pattern).

## 5. Acceptance criteria

1. Every former bare `Loading…` string renders the `Skeleton` primitive during its initial read. ✅
   (grep: no `<p …>Loading…</p>` remains in `apps/web/src`)
2. The loading state is announced via `role="status"` "Loading…" at every site (incl. the ~9 that
   previously announced nothing). ✅ (primitive contract + unit tests)
3. No motion added; reduced-motion-safe. ✅ (primitive has no entrance animation)
4. Gate green; bundle within budget, no growth. ✅ (343 Vitest passing + 83 e2e; **111.44 KB gz** < 120 KB)
