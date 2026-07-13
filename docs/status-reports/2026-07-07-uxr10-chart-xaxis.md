---
type: status-report
roadmap-item: BUD-S72
---
<!--
STATUS REPORT — UXR10 (Insights chart X-axis readability). The SECOND slice of the post-track polish batch
(UXR9–UXR13), an owner-directed batch opened after the UXR1–UXR8 UX Redesign track closed. Presentation-only:
in the shared apps/web/src/ui/Chart.tsx, both LineChart and BarChart x-axis labels are slanted -35° and
de-thinned so long envelope names read without collision; every Insights chart benefits at once. No
data/API/domain change. Newest report = the live handoff + launch pad for UXR11 / UXR12 / UXR13.
-->

# Status Report — 2026-07-07 (UXR10 — Insights chart X-axis readability)

| Field  | Value                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                           |
| Date   | 2026-07-07                                                                                         |
| Author | Claude (with the owner)                                                                            |
| Scope  | UXR10 built + `Done`; delta since [2026-07-07-uxr9-dashboard-ia.md](2026-07-07-uxr9-dashboard-ia.md) |

**Resume here:** **UXR10 is `Done` — the second slice of the owner-directed post-track polish batch
(`UXR9`–`UXR13`).** The Insights charts' X-axis labels (long envelope names) previously rendered
**horizontal** and were **thinned to ~8 max** (`step = ceil(n/8)`), so on a 22-envelope chart most labels
were dropped and the survivors still overlapped. In the **shared** [`ui/Chart.tsx`](../../apps/web/src/ui/Chart.tsx),
both **`LineChart`** and **`BarChart`** now render their X-axis labels **slanted to -35°** (`textAnchor="end"`
+ a per-label `rotate(-35 x y)` transform) and **de-thinned** through one shared helper
**`xLabelStep(n) = max(1, ceil(n/24))`** — keep **every** label up to 24, then thin (slanted labels pack ~3×
tighter than horizontal ones). To hold the slanted long names without clipping, the shared viewBox grew
**`H` 320→360** with **`PAD.bottom` 40→84** and a new **`AXIS_LABEL_Y`** anchor. **Only the shared primitive
changed**, so **every Insights chart benefits at once** — spend-by-envelope (`BarChart`), budget-vs-actual
(grouped `BarChart`), and the net-worth / cash-flow / trends `LineChart`s. `BreakdownBars` and `Gauge` have
their **own** viewBoxes and horizontal-only labels — **untouched**. The **a11y contract is intact**: the
axis labels live inside the `aria-hidden` decorative `<g>` (the `role="img"` summary + the fallback data
table remain the screen-reader source of truth), so slanting them is purely visual. **No data/API/domain
change.** Verified live via preview: `/insights/spend` now shows **all 22 envelope names** slanted without
collision (was ~8), `/insights/trends` line labels slanted (6 months), **no console errors**. **Follow-on
owner tweak (same slice):** the chart SVG's `max-width: 720px` cap was **removed** so each chart now **fills
its figure and is exactly as wide as the data table below it** (both bounded by the page's 960px reading
measure → 912px content); the viewBox scales fluidly, so wider = more room for the slanted labels — verified
live at 1440px (SVG 720→912, matching the table). Gate **green** — **433 Vitest + 121 e2e** (+2 Vitest:
slant transform + label density; the existing 6 Chart tests unchanged); build **125.32 KB gz** (+0.05 vs
125.27; CSS unchanged at 5.23; ~14.7 KB under the 140 KB budget). **Next:
UXR11 (add-transaction cleanup) / UXR12 (Manage formatting) / UXR13 (Allocate form on the pattern) — all
`Planned`, presentation-only, ordering is the owner's call (§7).**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Slanted X-axis labels (-35°) | `LineChart` + `BarChart` x labels now `textAnchor="end"` with a per-label `rotate(-35 ${x} ${AXIS_LABEL_Y})` transform (was `textAnchor="middle"`, horizontal) | [`Chart.tsx`](../../apps/web/src/ui/Chart.tsx) |
| Show more labels (de-thin) | One shared `xLabelStep(n) = max(1, ceil(n/24))` replaces the two inline `ceil(n/8)` / `ceil(g/8)` thinners — every label shows up to 24, then thins | [`Chart.tsx`](../../apps/web/src/ui/Chart.tsx) |
| Room for slanted names | Shared geometry: `H` 320→360, `PAD.bottom` 40→84, new `AXIS_LABEL_Y = H - PAD.bottom + 14` anchor — long names slant down-left without clipping the viewBox | [`Chart.tsx`](../../apps/web/src/ui/Chart.tsx) |
| Chart as wide as the table (owner tweak) | Removed the `.svg { max-width: 720px }` cap so each chart fills its figure = the data table's width (both bounded by the 960px reading measure); the viewBox scales fluidly. Verified live: SVG 720→912 at 1440px, matching the table below | [`Chart.module.css`](../../apps/web/src/ui/Chart.module.css) |
| Tests | +2 Vitest in [`Chart.test.tsx`](../../apps/web/src/ui/Chart.test.tsx): `LineChart` labels slanted -35°/end-anchored (all 3 shown); `BarChart` shows all 20 category names + 20 slanted labels (no thinning ≤ 24). Existing 6 Chart tests unchanged | [`Chart.test.tsx`](../../apps/web/src/ui/Chart.test.tsx) |
| Docs | Roadmap (UXR10 row → `Done`, focus + next-fronts + §5 log); `07_NFR` §1³ bundle delta (+0.04 → 125.31); this report | this change |

## 2. Definition of Done — current state (a presentation-only chart-primitive tweak)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Every Insights chart's X-axis reads without collision — verified live: `/insights/spend` renders all 22 envelope names slanted -35° (was ~8 horizontal/overlapping), `/insights/trends` line labels slanted. No data/API/domain change; the fix is in the one shared primitive so all charts move together. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** — **433 Vitest + 121 e2e**, build **125.31 KB gz**, `npm audit --omit=dev --audit-level=critical` exit 0 (3 pre-existing *high* advisories below the gate threshold). |
| Acceptance criteria met & tested | ✅ | Labels slanted ~-35° (owner's ask) — asserted in unit (`rotate(-35`, `text-anchor="end"`) and preview-inspected (`transform="rotate(-35 86.18 290)"`). More labels shown — unit asserts all 20 of 20 `BarChart` categories render (vs the old ~8 cap); preview shows all 22 real envelopes. Both `LineChart` and `BarChart` covered. |
| A11y (WCAG 2.2 AA) | ✅ | Contract unchanged: labels remain inside the `aria-hidden` decorative `<g>`; the `role="img"` one-line summary + the focusable fallback data table are still the SR/keyboard source of truth. Slanting is visual only — no new text enters the a11y tree, no contrast/opacity change. Existing a11y specs (axe light+dark over the Insights views) pass unchanged. |
| Input validation & secrets | ✅ | No schema/endpoint change; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | Roadmap (UXR10 row + focus + next-fronts + §5) · `07_NFR` §1³ · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 431 | 433 | +2 — `Chart.test.tsx`: `LineChart` slant/anchor + `BarChart` slant/density (long-name de-thinning). Existing 6 Chart tests unchanged |
| E2E | 121 | 121 | 0 — no e2e asserts on axis-label geometry; the change is visual within the shared primitive |

## 4. Design notes / small calls

- **-35°, end-anchored — the standard readable slant.** Each label anchors its right (near) end at the tick
  and descends to the lower-left, so it reads bottom-left → top-right. Steeper angles pack tighter but eat
  more vertical room and read worse; the owner asked for ~-35° and that's what's shipped.
- **`ceil(n/24)`, not "always show all".** Slanted labels tolerate far denser spacing than horizontal, so
  for the real data (≤ 22 envelopes, ≤ ~12 months) **all** labels show. But an unbounded axis (e.g. a
  60-point forecast line) would still collide, so a cap remains — just 3× looser than the old `ceil(n/8)`.
  One shared `xLabelStep` helper drives both charts, so `LineChart` and `BarChart` can't drift apart.
- **Geometry grew, not the data.** `H` and `PAD.bottom` changed so slanted long names don't clip; `INNER_H`
  is essentially unchanged (264→260), so the plot area — and every series/tick/legend position — is visually
  the same. The viewBox aspect shifts 2:1 → 1.78:1; the SVG scales fluidly (CSS `width:100%`, `height:auto`).
- **Only two shapes changed.** `LineChart` + `BarChart` own the horizontal categorical/time axis that
  overlapped. `BreakdownBars` (ranked horizontal bars, direct per-bar labels) and `Gauge` (single ratio)
  have no such axis and their own viewBoxes — deliberately left alone.
- **Chart width now matches the table (owner tweak).** The `.svg` carried a `max-width: 720px` cap, so on a
  wide screen the chart (720px) was visibly narrower than the data table below it (912px, at the 960px
  reading measure). Removing the cap lets the SVG fill its figure — same width as the table — with the
  viewBox scaling fluidly (`width: 100%`, `height: auto`). This affects **all four** chart shapes (they all
  render through the shared `.svg`), which is the intended consistency. No new cap is needed: the page's
  reading measure already bounds the figure, so the chart can never run wider than the surrounding content.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR10) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR10 code — both passed clean this run | Not blocking; watch |
| **Polish batch continues** — `UXR11`–`UXR13` `Planned` | UXR11 add-transaction (remove Accounts button + modal form on the pattern) · UXR12 Manage formatting · UXR13 shared `AllocationEditor` on the pattern | Owner picks order (all presentation-only) |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); a **dev stack**
  (`npm run dev` + `tsx watch`) auto-respawns on those ports, so **stop it before running e2e** (kill the
  `npm run dev` + `tsx watch` parents, not just the leaves — `tsx watch` restarts the API on crash).
- **Charts** = the shared [`ui/Chart.tsx`](../../apps/web/src/ui/Chart.tsx) primitives (`LineChart`,
  `BarChart`, `BreakdownBars`, `Gauge`); the six Insights views pass their existing analysis table as the
  a11y fallback. X-axis labels are now slanted -35° + de-thinned via `xLabelStep`. Geometry constants live
  at the top of the file (`W`/`H`/`PAD`/`AXIS_LABEL_Y`).
- **Insights routes**: `/insights` → `/insights/spend`; `spend` (By envelope, `BarChart`) · `budget`
  (vs Actual, grouped `BarChart`) · `breakdown` (`BreakdownBars`) · `trends`/`forecast`/`networth`
  (`LineChart`) · `credit`/`payoff` (`Gauge`). Sub-tab navs use `.categoryNav`/`.segmentNav`.
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr10-chart-xaxis.md — its
  "Resume here" has state (UXR10 chart X-axis is Done; gate green at 433 Vitest + 121 e2e, build
  125.31 KB gz; the two pre-existing e2e flakes are watch-only).
- Read docs/03_ROADMAP.md — the "UX Redesign — post-track polish (UXR9–UXR13)" subsection in §4 and
  the "Next fronts" line show what's left in the batch.

The owner-directed post-track polish batch (UXR9–UXR13) is underway. UXR9 (Dashboard IA) and UXR10
(chart X-axis readability) are DONE. Continue with the batch — all presentation-only, ordering is the
owner's call:
- UXR11 — Add-transaction: remove the page-local "Add transaction" button on /accounts
  (apps/web/src/AccountsList.tsx); re-lay the quick-add modal form (apps/web/src/AddTransactionForm.tsx,
  still raw <label>/<select>/<input>) on the FormLayout.module.css pattern the other forms use.
- UXR12 — Manage page formatting: re-lay ManageView (net-worth table + management links) on the
  design-system table/section treatment (Ledgers.module.css).
- UXR13 — the shared AllocationEditor "Allocate" form (raw <label>/<select>/<input>/<button>) onto the
  FormLayout pattern (Field/Input/Select + split-line mini-grid). Shared — also in the add-transaction
  modal (UXR11), the account register, and needs-allocation; behaviour byte-for-byte. Coordinate with UXR11.

Confirm the next item with the owner if unsure. Keep it vertical and gate-green; update docs in the
same change; leave the project handoff-ready with a next-session kickoff prompt. NOTE: the e2e gate
needs ports 3001/5173 free — a running dev stack (npm run dev + tsx watch) must be stopped first.
Provide a single-line short commit message; the owner reviews and commits.
```
