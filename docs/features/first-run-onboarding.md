<!--
FEATURE SPEC — scopes roadmap item UX14 (2026-06-25 UX Uplift, Phase 4 "Polish"): empty states &
first-run onboarding. Fast-path ceremony (docs/00_WAYS_OF_WORKING.md §11): this note IS the spec — a
small presentation slice composing the existing UX4 EmptyState + routing. No ADR / no spike / no new
dependency. No data / API / domain change (onboarding state is DERIVED from existing reads).
-->

# Feature Spec — Empty states & first-run onboarding (UX14)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX14                                                             |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux14.md))   |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-02                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX14`, §5 Phase 4) · composes the `EmptyState` primitive from [FEAT-UX4](design-system.md) · sits in front of the [cockpit](cockpit.md) home · ties to [PRD §5](../02_PRD.md) week-one success metric |

## 1. Summary

A brand-new user opening a **completely empty** Budgeteer met the [cockpit](cockpit.md)'s **five
disconnected per-panel empty states** ("No monthly targets yet", "Everything is allocated", "No
forecast yet"…) — a fragmented, un-guided first impression. This slice puts one **guided next step**
in front of a truly empty app: a `FirstRunOnboarding` surface that welcomes the user and points them
at the two first actions — **add your first account, then set up your envelopes** — tied to the PRD's
week-one success metric ("still keeping it current past week one").

The moment **anything** exists (one account or one envelope), onboarding disappears and the cockpit
takes over — its per-panel empty states then guide the remaining setup (progressive disclosure).

## 2. Scope

- **New `FirstRunOnboarding` component** (`apps/web/src/FirstRunOnboarding.tsx` + `.module.css`) —
  pure presentation, **composes the existing UX4 `EmptyState`** with a welcome title, a lead line, and
  an **ordered list of two guided steps**, each with an accent CTA `<Link>` ("Add an account" →
  `/accounts`, "Add envelopes" → `/envelopes` — the routes that already own creation).
- **`Home`** now **derives** first-run state and branches: it reads `listAccounts` + `listEnvelopes`
  once, shows a `Skeleton` while deciding, then renders `FirstRunOnboarding` if **both** are empty,
  else the `Cockpit`. On a read error it falls through to the cockpit (which degrades per panel).

**Out of scope (right-sized, §11):** no per-view onboarding tours; the existing cockpit per-panel
empty states and the list-page "No accounts/envelopes yet" copy are unchanged (they already guide the
next step once you've started). No data/API/domain change; no dependency.

## 3. Design — derive, don't store; guide, don't gate

- **Derive-don't-store (a non-negotiable, `00_WAYS_OF_WORKING.md` §3 / CLAUDE.md):** "first run" is a
  **derived** predicate — `accounts.length === 0 && envelopes.length === 0` from the existing ledger
  reads — **not** a new server "has onboarded" flag. There is no second source of truth to drift, and
  nothing to migrate; the surface is self-correcting the instant real data appears.
- **Replace, not prepend:** on a truly-empty app the guided screen **replaces** the cockpit grid
  rather than sitting above five empty panels — a first-run app should feel guided, not like a
  dashboard full of blanks. Once data exists the full cockpit returns (no half-onboarded state).
- **Composition over new primitives:** reuses the validated `EmptyState` (dashed panel + centered
  title); the only new CSS turns the two steps into a left-aligned ordered list with accent CTA links.
- **No ADR / no spike / no new dependency:** additive presentation on the UX4 tokens + React Router.
  §11 fast-path — this note is the paperwork.

## 4. A11y coverage

- **Structure:** the surface is a **named region** (`aria-label="Get started"`) under the home's
  `<h1>Budgeteer</h1>`; the two steps are an **ordered `<ol>`** so their sequence is conveyed by
  structure, and the CTAs are real `<Link>`s (keyboard + SR reachable). Order and state are carried by
  **text + list structure, never colour**.
- **Non-text contrast (WCAG 1.4.11):** the CTA links use `--color-on-accent` on `--color-accent`
  (≥ 4.5:1 in **light and dark**, from the UX4 token sheet's `prefers-color-scheme` variants).
- **Unit** (`FirstRunOnboarding.test.tsx`): named region + welcome title; the two guided steps render
  as an ordered list of two items; the CTAs link to `/accounts` and `/envelopes`. Plus `Home.test.tsx`
  guards the derived branch (empty app → onboarding, not the Overview; seeded app → cockpit, not
  onboarding).
- **E2E axe (`e2e/a11y.spec.ts`), LIGHT AND DARK:** the onboarding surface is scanned with it
  **visible** in both schemes. Because the e2e store is run-scoped and never reset, the empty-store
  scans are placed **first** in the (alphabetically-first) `a11y.spec.ts`, before any test seeds data.

## 5. Acceptance criteria

1. A completely empty app (no accounts AND no envelopes) shows the guided `FirstRunOnboarding` on the
   home, not the cockpit. ✅
2. First-run is **derived** from existing reads — no new server/onboarding state. ✅
3. The onboarding's two CTAs deep-link to `/accounts` and `/envelopes`; adding either makes the
   cockpit take over. ✅
4. The surface is a named region with an ordered two-step list and keyboard-reachable link CTAs;
   order/state never colour-only. ✅
5. Axe-clean with the onboarding surface visible in **light AND dark**. ✅
6. Gate green; **no new dependency**; bundle within budget. ✅ (364 Vitest passing + 92 e2e;
   **117.20 KB gz** < 120 KB)
