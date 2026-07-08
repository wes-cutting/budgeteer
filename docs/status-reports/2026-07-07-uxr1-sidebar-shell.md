<!--
STATUS REPORT — UXR1 (sidebar app shell), the first user-facing UX-Redesign slice. A large,
whole-app chrome rewrite (00 §11 "as written" ceremony): the shell now owns the single <h1>, so
every routed view + its heading assertions (unit + e2e) re-pointed once. Newest report = the live
handoff + launch pad for UXR2.
-->

# Status Report — 2026-07-07 (UXR1 — sidebar app shell)

| Field  | Value                                                                    |
| ------ | ------------------------------------------------------------------------ |
| Status | Snapshot                                                                 |
| Date   | 2026-07-07                                                               |
| Author | Claude (with the owner)                                                  |
| Scope  | UXR1 built + `Done`; delta since [2026-07-07-uxr8-demo-seed.md](2026-07-07-uxr8-demo-seed.md) |

**Resume here:** **UXR1 is `Done`** — the UX3 top-banner chrome is replaced by the reference
**sidebar shell**: a grouped left `<nav aria-label="Primary">` (**Budget · Ledgers · Planning ·
Administration**, footer = the global **Add transaction**), a **top bar** (collapse toggle · the
page's single `<h1>` · a compact **+ Add** at ≤ 640px), and the route as the content canvas.
Desktop **collapse-to-rail** persists client-side (`localStorage budgeteer.sidebar`); at ≤ 640px the
sidebar is an off-canvas **drawer on the Radix `Dialog`** machinery (focus trap / Esc / scrim /
focus-restore). **NO route/data/API/domain change** (ADR-0006 routing unchanged). The shell now
**owns the single `<h1>`** (route-handle titles + a title context for the dynamic account/envelope
names; `document.title` synced) — so every routed view dropped its `<h1>` (Insights views demoted to
`<h2>`; `ErrorBoundary` keeps its top-level `<h1>`). Icons are **repo-owned lucide (ISC) paths** in
[`ui/icons.tsx`](../../apps/web/src/ui/icons.tsx) (zero dependency). Gate **green** — **421 Vitest +
109 e2e**, build **122.51 KB gz** (+3.84 vs 118.67; well under the 140 KB budget). **Next: UXR2 (the
pay-period planner)** — see §7 for the kickoff prompt.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Sidebar shell | `AppShell.tsx` + `.module.css` rewritten: grouped sidebar (one nav landmark, four `aria-labelledby` group lists) · top bar (toggle · `<h1>` · compact + Add) · footer Add-transaction | [`AppShell.tsx`](../../apps/web/src/AppShell.tsx) |
| Rail + drawer | Expanded↔rail persisted (`budgeteer.sidebar`); ≤ 640px off-canvas drawer on `@radix-ui/react-dialog` (**no new dependency** — reuses UX7's) with explicit focus-restore to the hamburger | `AppShell.tsx` |
| Page-title mechanism (Q3) | `PageTitleContext` + `useSetPageTitle`; static routes carry `handle: { title }` (read via `useMatches`); account register / envelope ledger publish their resolved name (kind-label fallback); `document.title` follows | `AppShell.tsx` · [`routes.tsx`](../../apps/web/src/routes.tsx) |
| Icon set (Q4) | `ui/icons.tsx` — 15 lucide (ISC) glyphs copied into repo-owned components; license + attribution in the header | [`ui/icons.tsx`](../../apps/web/src/ui/icons.tsx) |
| Blast radius (~16 views) | Every routed view dropped its `<h1>`; Insights views demoted to `<h2>`; account/envelope publish their name; `ErrorBoundary` keeps its `<h1>` (top-level, replaces the shell) | view `*.tsx` |
| Tests re-pointed | `AppShell.test` rewritten (3 → 9: groups · title · dynamic-title context · badge modes · rail persistence · drawer); `Home`/`AnalysisSection`/`PayPeriodsView` heading levels; new `e2e/app-shell.spec.ts`; `e2e/setup.ts` (`"Budgeteer"`→`"Home"`, Insights sub-nav scoping); `a11y.spec.ts` gains rail + drawer scans (light AND dark) + viewport-reset `afterEach` | unit + `e2e/` |
| Docs | FEAT-UXR1 → `Implemented` (+ §7 "as built"); FEAT-UX3 chrome marked **superseded**; `07_NFR` §1³ bundle delta; roadmap row → `Done` + changelog | this change |

## 2. Definition of Done — current state (a vertical UI slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The shell frames every route in the running app: grouped sidebar, active-item edge-bar + `aria-current`, top-bar title, rail toggle, ≤ 640px drawer, Add-transaction from every mode. Same URLs/data behind new chrome. |
| Gate green | ✅ | `typecheck · lint · format · unit · e2e · build · SCA` all pass — **421 Vitest + 109 e2e**, build **122.51 KB gz** (+ 4.55 KB gz CSS), audit clean at `--audit-level=critical`. |
| Acceptance criteria met & tested (UX §9) | ✅ | Active item marked + top bar names the page; toggle → rail survives reload (localStorage); ≤ 640px hamburger → drawer with focus inside, Esc/scrim/navigate close + focus restored; badge count in every mode + in the link's `aria-label`; axe green light AND dark in expanded · rail · drawer; 320px no horizontal page scroll; every route URL-addressable; Add-transaction from every mode. |
| A11y (WCAG 2.2 AA) | ✅ | One nav landmark (grouped `aria-labelledby` lists), one banner, one `<main>`; **exactly one `<h1>` per page** (shell top bar); rail keeps accessible names (aria-label) + tooltips; drawer rides the SPIKE-06-validated Radix `Dialog`; axe light + dark across the new states (a11y.spec rail + drawer scans); motion gated by `prefers-reduced-motion`. |
| Input validation & secrets | ✅ | N/A — chrome-only slice; no new inputs, no I/O added (the badge fetch is the carried UX3 read). localStorage holds UI state only, never API state. |
| Docs updated in same change | ✅ | FEAT-UXR1 `Implemented` · FEAT-UX3 chrome superseded · `07_NFR` §1³ · roadmap (row + changelog) · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 415 | 421 | +6 (`AppShell.test` 3 → 9: title/context · rail persistence · drawer; other view heading assertions re-pointed, not added) |
| E2E | 99 | 109 | +10 (`app-shell.spec.ts`: rail persistence · drawer open/Esc/scrim/navigate · compact Add · single-`<h1>`; `a11y.spec.ts`: rail + drawer scans, light AND dark) |

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from the scoping/UXR8 reports); the shell was built from the spec §5 wireframes + §7 copy | Owner, when convenient |
| Pay-periods dual-highlight | The Planning "Pay periods" item deep-links into `/insights/pay-periods`, so both **Insights** and **Pay periods** mark active there — transitional until **UXR2** promotes it to `/pay-periods` | Resolved by UXR2 |
| FEAT-S7 §5 divergence ratify/veto | Untouched by UXR1; still the roadmap's open decision | Owner |

## 5. Outstanding & next steps

- Commit (suggested: `feat: UXR1 — sidebar app shell (grouped nav · rail · drawer · shell owns the <h1>)`).
- Build **UXR2** next (brief §5 order): the pay-period planner — see §7.

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- The shell **owns the single `<h1>`** — every routed view dropped its own. Insights views are now
  `<h2>`; `ErrorBoundary` keeps its `<h1>` (top-level, replaces the shell). Static titles come from
  the route `handle`; the account register / envelope ledger publish their name via `useSetPageTitle`.
- **At ≤ 640px the sidebar nav is off-canvas** (the drawer takes over). e2e that navigates via the
  sidebar must do so at desktop width **before** shrinking; `openAnalysis` scopes its tab click to
  the "Insights views" sub-nav (the sidebar now also has a "Pay periods" item).
- The rail choice persists in `localStorage` (`budgeteer.sidebar`) — UI state only.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr1-sidebar-shell.md — its
  "Resume here" has state (UXR1 is Done; the gate is green at 421 Vitest + 109 e2e; build 122.51 KB gz).
- Read docs/03_ROADMAP.md — the next item is UXR2 (pay-period planner), gated by UXR1 (now Done).

Next milestone: UXR2 — rework the shipped S7 pay-periods surface into the sheet's planner shape.
Spec of record: docs/ux/pay-periods-planner.md + docs/features/pay-periods-planner.md (FEAT-UXR2),
both Proposed, every design question owner-resolved 2026-07-06. Two threads:
  (1) PLACEMENT — promote /insights/pay-periods → a first-class /pay-periods route (the sidebar's
      Planning "Pay periods" item retargets; the old URL redirects; the cockpit gains a
      "Next paycheck" deep-link line, in-slice). This retires the UXR1 transitional dual-highlight.
  (2) PRESENTATION — re-lay the stacked bucket sections as TWO side-by-side ledgers (bills: due ·
      amount · left-to-pay countdown · covered-by ‖ paychecks: income · committed · headroom ·
      projected balance · reserve · status badge), whole horizon on one screen; selection-highlight
      additive over the permanent "Covered by" structural join (colour-only join stays banned).
  Data: additive projectedBalanceCents + reserveCents on GET /analysis/pay-periods (same gather as
  the forecast; 06_API_CONTRACT updated in the same change). Reserve = running Σ of per-check
  headroom (runs down through over-committed buckets, no clamp); Balance = projected payday balance.
  Left-to-pay countdown in BOTH scopes (month column + subtotal rows · 90-day pane figure).

Watch out for: (1) this is the FIRST UXR item that touches data/API (additive read fields) — spec
the contract change and add API tests; the assignment POLICY is explicitly NOT in scope (FEAT-S7 §5
ratify/veto stays its own open decision). (2) the shell owns the <h1> now (UXR1) — the page title
for /pay-periods comes from a route handle; the view renders <h2>+ only. (3) the S7 view's e2e/unit
still assert "Insights — pay periods" as an <h2> under Insights; moving to /pay-periods re-points
those. (4) keep the two-ledger layout reflow-safe at 320px (UX15 bar) and axe-clean light AND dark.
(5) demo data: `npm run db:reset && npm run seed:demo` gives a lived-in planner to design against.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change (FEAT-UXR2 → Implemented,
06_API_CONTRACT, NFR bundle delta, roadmap); and at the end leave the project handoff-ready with the
next-session kickoff prompt (for UXR3) in the status report.
```
