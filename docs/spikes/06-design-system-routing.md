<!--
SPIKE REPORT — the deliverable; the code is disposable (lives at
spikes/06-design-system-routing/, gitignored deps). See docs/00_WAYS_OF_WORKING.md §6.
Scopes roadmap item UX1 of the 2026-06-25 UX Uplift initiative.
-->

# SPIKE-06: Which routing + design-system + a11y-primitive stack converts a real screen without regressing the axe gate?

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| Status     | **Done**                                                                                     |
| Type       | Technical / feasibility (decision bake-off)                                                  |
| Owner      | Wesley Cutting                                                                               |
| Time-box   | ~2 focused sessions — honored (converged once the a11y gate + bundle numbers were in)        |
| Date       | 2026-06-25                                                                                   |
| Blocks     | [`ADR-0005`](../adr/ADR-0005-frontend-design-system.md) (styling) · [`ADR-0006`](../adr/ADR-0006-client-routing.md) (routing) · `UX3` (app shell) · `UX4` (component library) · the whole UX Uplift build |
| Scopes     | `UX1` in the [2026-06-25 UX uplift initiative](../reviews/2026-06-25-ux-uplift-initiative.md) |
| Result     | **Viable axe-green stack confirmed.** Recommend **React Router + design tokens/CSS Modules + Radix Primitives**. The bake-off **flipped the pre-spike primitive lean** (React Aria → Radix) on bundle cost. |

## 1. The question

The UX Uplift **reverses the repo's deliberate "no design system" stance** and replaces the
hand-rolled `view` state machine with a router — two changes everything else rides on. Before we
commit them in an ADR and migrate screens, **one** question:

> **Of the candidate client-routing, styling, and headless-a11y-primitive options, which
> combination converts the Account Register into a routed, design-token-styled screen that stays
> axe-clean (WCAG 2.2 AA) and within the perf/bundle budget — and is any candidate disqualified
> on accessibility or cost?**

Owner chose a **bake-off** (compare options head-to-head) on the **Account Register** as the probe.

## 2. Method

A **throwaway** harness at `spikes/06-design-system-routing/` (Vite + React 18 + TS, standalone —
*not* the V1 app) that rebuilds a representative Account Register (table + filter form + delete +
an allocation-editor **Dialog**) with self-contained data, then:

- **Builds the lead screen end-to-end** (React Router + design tokens + CSS Modules + a React Aria
  dialog) — strict `tsc` + `vite build` — as the existence proof.
- **Isolates per-library bundle cost** via lib-mode entries with **React externalized**, so each
  gzipped output is *only* that library's own code (`src/measure/*`).
- **Scans accessibility in real Chromium** (`scripts/axe-browser.mjs` → Playwright + `axe-core`,
  WCAG 2.2 AA tag set) on the lead screen and **both** dialog implementations (React Aria + Radix),
  each rendered open.
- **Measures Tailwind's purged CSS** for the same screen (`tailwindcss` CLI, `--minify`) against
  the hand-rolled token sheet.

Resolved candidate versions: `react-router@7.18.0` · `@tanstack/react-router@1.170.16` ·
`react-aria-components@1.19.0` · `@radix-ui/react-dialog@1.1.17` · `tailwindcss@3.4.19`.

**Deliberately not done:** other screens, the full component library, the cockpit, production
wiring, visual polish. Harness code is discarded once findings are absorbed.

## 3. Findings

**Existence proof.** The lead screen (React Router + tokens/CSS-Modules + React Aria dialog)
type-checks (strict, exit 0) and builds: **310 KB raw / 101 KB gzip** JS, **1.22 KB gzip** CSS.
Deep-link to `/accounts/:id`, browser back/forward, and refresh all work; the `view`-machine
"← Dashboard" button is gone.

**Accessibility (real Chromium, WCAG 2.2 AA tags) — the gate:**

```
## Account Register (lead screen)  (/accounts/chk)   violations: 0
## React Aria dialog               (/aria-demo)       violations: 0
## Radix dialog                    (/radix-demo)      violations: 0
=== TOTAL violations across all targets: 0 ===
```

**Bundle cost (gzipped; React externalized → isolates each library's own code):**

| Library | gzip | raw |
| ------- | ---- | --- |
| React Router (routing) | **39.6 KB** | 140.6 KB |
| TanStack Router (routing) | **36.1 KB** | 135.5 KB |
| React Aria Components (dialog surface) | **29.7 KB** | 107.0 KB |
| Radix Dialog | **13.9 KB** | 47.5 KB |

**Styling CSS cost (gzipped, for the same screen):** Tokens + CSS Modules **1.22 KB** · Tailwind
(purged + preflight) **2.16 KB**.

**Scoring matrix:**

| Criterion | React Router | TanStack | Tokens+CSS-Mod | Tailwind | React Aria | Radix |
| --------- | ------------ | -------- | -------------- | -------- | ---------- | ----- |
| **A11y (gate)** | — | — | **axe 0** (lead screen) | passes (same tokens) | **axe 0** (dialog) | **axe 0** (dialog) |
| **Bundle (gz)** | 39.6 KB | 36.1 KB | 1.22 KB css | 2.16 KB css | 29.7 KB | **13.9 KB** |
| **Fit / restraint** | conventional, low boilerplate | typed but more boilerplate | **zero-dep, legible, matches restraint** | utility class-soup + toolchain | all-in system | **lean, per-component** |
| **Type-safety** | params untyped (`string?`) | **typed routes/params/search** | typed token access | n/a | typed | typed |
| **Ergonomics** | familiar, huge ecosystem | newer, more setup | manual authoring | **fast authoring** | batteries-included | composition; must add `Title` |

### Confirmed
- **A viable axe-green stack exists** — the falsifiable core is **YES**. The lead screen is 0 axe
  violations in real Chromium and builds at 101 KB gz.
- **Both primitive libs clear the a11y gate** (axe 0 on the real dialog) — accessibility
  **disqualifies neither**, so axis C is decided on cost/ergonomics, not a11y.
- **Tokens + CSS Modules** deliver the smallest CSS and full dark-mode from a single
  `prefers-color-scheme` media query, with zero runtime dependency.

### Invalidated
- **The pre-spike lean toward React Aria Components was wrong on cost.** Both pass a11y, but
  Radix's dialog is **13.9 KB gz vs React Aria's 29.7 KB** (< half), and Radix installs
  **per-component** (pay only for the widgets used). → **Primitive recommendation flips to Radix.**
- **The assumption that TanStack Router is "heavier" is false** — it is **slightly smaller** than
  React Router (36.1 vs 39.6 KB gz). (Corrects the premise; doesn't flip the routing call.)

### Surprises / unknowns uncovered
- React Aria Components pulls a large shared core (~30 KB gz) even for a single component —
  economical only if adopted broadly.
- Tailwind's purged CSS (2.16 KB gz incl. preflight) is small but ~1.8× the token sheet at this
  scale; Tailwind's real cost here is authoring style + toolchain, **not** bytes.

## 4. Recommendation / decision

Adopt **React Router + design tokens (CSS custom properties) + CSS Modules + Radix Primitives**:

- **Routing → React Router 7** ([`ADR-0006`](../adr/ADR-0006-client-routing.md)). Bundle is a
  near-tie (TanStack ~3.5 KB lighter); conventionality, ecosystem depth, and low boilerplate
  decide. *TanStack is the credible alternative if typed routes/params become a priority.*
- **Styling → CSS tokens + CSS Modules** ([`ADR-0005`](../adr/ADR-0005-frontend-design-system.md)).
  Smallest CSS, zero runtime dep, full a11y control, dark mode from one media query, matches the
  repo's restraint. *Tailwind rejected as default: class-soup + toolchain, larger CSS at this
  scale, less direct a11y control — though faster to author.*
- **Primitives → Radix Primitives** (in `ADR-0005`), per-component. Both libs pass the a11y gate;
  Radix is < half the bundle and pay-per-widget. *React Aria kept as the alternative if its richer
  form/collection/i18n system is wanted later.*

**Residual (low):** the full screen was built with React Aria's dialog (axe 0); the Radix dialog
was validated standalone (axe 0). Composition risk is low (screen-minus-dialog is axe 0 **and**
the Radix dialog is axe 0). **No follow-up spike needed** — `UX4` builds the component library on
Radix and re-runs the gate.

## 5. Impact on the plan

- **Specs/ADRs:** [`ADR-0005`](../adr/ADR-0005-frontend-design-system.md) +
  [`ADR-0006`](../adr/ADR-0006-client-routing.md) written from this recommendation → **`Validated`**
  by SPIKE-06.
- **Sequencing:** `UX1` → **Done**; `UX3` (app shell) and `UX4` (component library) → **Ready**,
  built on the chosen stack.
- **Bundle budget:** baseline recorded (lead app 101 KB gz with React Aria; **~85 KB gz projected**
  with Radix instead). Set a formal **web bundle budget** in [`07_NFR.md`](../07_NFR.md) from the
  real `UX3` shell build.

## 6. Follow-ups

- [x] Write `ADR-0005` + `ADR-0006` from the recommendation; set `Validated`.
- [x] `UX1` → Done; promote `UX3` / `UX4` to `Ready` in [`03_ROADMAP.md`](../03_ROADMAP.md); log the re-sequence.
- [ ] Set the **web bundle budget** in [`07_NFR.md`](../07_NFR.md) from the `UX3` shell baseline.
- [ ] Discard `spikes/06-design-system-routing/` once its findings are absorbed into `UX3`/`UX4` (throwaway).
