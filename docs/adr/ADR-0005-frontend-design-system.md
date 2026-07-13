---
type: adr
id: ADR-0005
status: Validated
---
<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Stay Proposed until a spike validates the assumptions.
-->

# ADR-0005: Frontend design system — CSS custom-property tokens + CSS Modules + Radix Primitives

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Validated                                                          |
| Date          | 2026-06-25                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | [`SPIKE-06`](../spikes/06-design-system-routing.md) (lead screen + both dialogs axe-clean in real Chromium; per-library bundle measured) |

## Context

The [UX Uplift initiative](../reviews/2026-06-25-ux-uplift-initiative.md) **reverses the repo's
deliberate "no design system" stance** — today [`apps/web/src/index.css`](../../apps/web/src/index.css)
is a 14-line WCAG floor and every screen is raw browser-default HTML. We need a styled, themeable,
**accessible** component vocabulary that does **not** regress the project's WCAG 2.2 AA / axe-clean
bar, fits the repo's restraint (minimal deps, legible diffs), is desktop-first, and supports dark
mode. The hard part is the interactive widgets (dialog, menu, toast, tabs) where focus management
and ARIA are easy to get wrong. [`SPIKE-06`](../spikes/06-design-system-routing.md) baked off the
options on a real Account Register.

## Decision

We will build the web app's styling on three layers:

- **Design tokens as CSS custom properties** — color, space, type scale, radius, elevation — with
  **dark mode** from a single `prefers-color-scheme` media query and `prefers-reduced-motion`
  honored globally. One token sheet; no JS, no runtime.
- **Component-scoped CSS Modules** for component styles — **no utility framework, no CSS-in-JS
  runtime**. Styles live next to components and reference tokens.
- **Radix Primitives** for the hard interactive a11y widgets (Dialog, Menu, Toast, Tabs, …),
  installed **per-component** so we pay only for the widgets we use.

The `UX4` component library (Button, Card, Table, Field, Badge, Dialog, Menu, Toast, EmptyState,
Skeleton, ProgressBar) is built on these layers and re-runs the axe gate.

## Consequences

### Positive
- **Smallest CSS** — 1.22 KB gz for the probe screen vs Tailwind's 2.16 KB; **zero styling
  runtime/dependency**.
- **Full a11y control, proven** — the token-styled screen and the Radix dialog are **0 axe
  violations** in real Chromium (WCAG 2.2 AA); the existing bar holds.
- **Lean, pay-per-component primitives** — Radix's dialog is **13.9 KB gz** vs React Aria's
  29.7 KB; per-component installs keep the bundle proportional to widgets used.
- **Dark mode + reduced-motion fall out of the token sheet**; legible diffs; matches the repo's
  minimalism.

### Negative / cost
- **More manual authoring** than Tailwind utilities; tokens + CSS Modules need a small set of
  conventions to stay consistent.
- **Radix is composition-first** — e.g. a `Dialog.Title` is required for the accessible name
  (omitting it warns); contributors must learn the primitive contracts.

### Neutral
- Tokens are framework-agnostic; primitives are swappable behind the `UX4` component API.

## Alternatives considered

### Tailwind CSS
Faster to author and a strong system, but utility class-soup in JSX, a postcss/config toolchain,
larger CSS at this scale (2.16 KB gz incl. preflight), and less direct a11y control. Rejected as
default; reconsider only if authoring velocity on a much larger surface dominates.

### React Aria Components (as the primitive lib)
Excellent accessibility and a richer all-in system (forms, collections, i18n) — and it **also**
passed the axe gate (0 violations). Rejected as default purely on **cost**: ~2× the bundle
(29.7 vs 13.9 KB gz for a dialog) and a large shared core even for one component. **Kept as the
alternative** if its richer form/collection/i18n system is wanted later.

### CSS-in-JS (vanilla-extract / styled-components)
Co-located styles, but a runtime/bundle cost and a heavier dependency for no a11y benefit here.

## Supersedes / superseded by

- Supersedes: — (consciously reverses the prior informal "no design system" stance recorded in
  `apps/web/src/index.css`; that file's WCAG touch-target floor is absorbed into the token base).
- Superseded by: —
