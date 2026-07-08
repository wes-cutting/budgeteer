<!--
STATUS REPORT — UXR4 (Templates page). Presentation-only: the saved-templates LIST becomes a
design-system table (reusing the UXR3 treatment), and the template editor is re-organized onto a NEW
reusable form-layout pattern (FormLayout.module.css) that UXR5/UXR7 will import. No data/API/domain
change. Newest report = the live handoff + launch pad for UXR5.
-->

# Status Report — 2026-07-07 (UXR4 — Templates page)

| Field  | Value                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                           |
| Date   | 2026-07-07                                                                                         |
| Author | Claude (with the owner)                                                                            |
| Scope  | UXR4 built + `Done`; delta since [2026-07-07-uxr3-ledgers-tables.md](2026-07-07-uxr3-ledgers-tables.md) |

**Resume here:** **UXR4 is `Done`** — the Templates page is rebuilt **presentation-only** over the
existing template reads/flows (no data/API/domain touched). The **saved-templates list is now a real
table** — **Name** (`<th scope="row">`) · **Lines** · **Total** · **Actions** — reusing the **UXR3
[`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css) treatment verbatim** (no third
duplicate); per-row action names ("Rename {name}" / "Delete {name}"), inline rename swaps the name
cell, the UX12 delete `ConfirmDialog` carried. The **template editor is re-organized onto the new
form-layout pattern** — and **this slice's real deliverable is that pattern**, now built in
**[`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css)**: `<fieldset>`+visible
`<legend>`, the UX4 `Field`/`Input`/`Select` primitives (stacked label→control), the envelope/amount
**line mini-grid** (shared grid template on header + rows so columns align; amount
right-aligned/monospaced; per-row `aria-label`s kept — "Template envelope N" · "Template amount N" ·
"Remove line N"; "+ Add line" beneath), a right-aligned **action row**, and a ~44rem width cap.
**UXR5 (Recurring) and UXR7 (Manage) restyle by importing this module — no new pattern code.**
Behavior is **byte-for-byte** (blank/zero lines filtered on save · form resets after create · no new
field validation). **In passing I fixed a latent `.numeric` right-align bug** (see §4). Gate
**green** — **427 Vitest + 111 e2e** (+1 dark-mode Templates axe scan); build **124.47 KB gz** (+0.38
vs 124.09; ~15.5 KB under the 140 KB budget). **Next: UXR5 (Recurring) — §7 kickoff.**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Saved templates → table | `Name` (row header) · `Lines` · `Total` · `Actions`, in the global `.table-scroll` region with an `sr-only` `<caption>`; reuses `Ledgers.module.css` (`.table`/`.numeric`/`.actions`) verbatim; per-row "Rename {name}" / "Delete {name}"; inline rename; UX12 `ConfirmDialog` unchanged | [`TemplatesView.tsx`](../../apps/web/src/TemplatesView.tsx) |
| **Form-layout pattern (the deliverable)** | New reusable module: `.form` (~44rem cap) · `.fieldset`/`.legend` · `.lineGrid`/`.lineHeader`/`.lineRow` (shared grid template) · `.amount` (right/tabular) · `.addLine` · `.actionRow`. Built off UX4 primitives + tokens — **no new dependency** | [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) |
| Editor re-organized | `<fieldset>`/`<legend>New template>`; Name via `Field`; envelope/amount line mini-grid (per-row names kept; header row `aria-hidden`); "+ Add line"; right-aligned action row with `Save template` (accent primary). Create/reset behavior identical | [`TemplatesView.tsx`](../../apps/web/src/TemplatesView.tsx) |
| `.numeric` specificity fix | `.numeric` → `.table .numeric` so right-align actually applies (it had been silently defeated on `<td>`/`<th>`); money now right-aligns across **all four** ledger/Templates tables | [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css) |
| UX spec → Implemented | `docs/ux/templates-page.md` promoted + §8 "as built" added | [UX spec](../ux/templates-page.md) |
| Tests | `TemplatesView.test` re-pointed (`role="list"`→`role="table"`; `getByLabelText("Name")`; "Delete {name}"). e2e: `templates.spec` re-pointed to the table + `exact:true` on "Name"; `a11y.spec` seeds a template so the **table** is scanned and adds a **dark-mode Templates** scan (light AND dark) | unit + `e2e/` |
| Docs | UX spec → `Implemented` (+§8); `07_NFR` §1³ bundle delta; roadmap (row `Done` + focus + next-build + changelog); this report | this change |

## 2. Definition of Done — current state (a presentation-only UI slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Templates renders as a scan-and-act table + an organized editor; every carried behavior works against the running app (verified live on the demo seed: create with multiple lines, "+ Add line", remove line, save+reset, inline rename, confirmed delete). No data/API/domain change — the same reads/flows behind a new shape. |
| Gate green | ✅ | typecheck · lint · format · unit · build · SCA all **pass** — **427 Vitest + 111 e2e**, build **124.47 KB gz**, audit clean at `--audit-level=critical`. (The two independent **pre-existing** e2e flakes carried since UXR2 — `spend by envelope` cold-start, `transfers` delete — remain watch-only, not UXR4 code; see §5.) |
| Acceptance criteria met & tested (UX §6) | ✅ | Saved templates render as the §2 table; rename + confirmed delete work as today (specs re-pointed, no flow rewritten). The editor renders on the §3 pattern (every control via `Field`/aria, lines as the mini-grid, actions right-aligned); create/reset byte-for-byte equivalent. The §3 pattern is reusable as built (it lives in its own module UXR5/UXR7 import). Empty/loading(`Skeleton`)/error(`role="alert"`) carried; axe light+dark; 320px reflow. |
| A11y (WCAG 2.2 AA) | ✅ | Real table (`<th scope="col">`; name cell `<th scope="row">`; `sr-only <caption>`); per-row action names ("Rename {name}", "Delete {name}"); the editor's fieldset/legend announce the group, `Field` ties every label, the line grid keeps per-row names; the table sits in a `.table-scroll` focusable region — **320px reflow verified live** (page `scrollWidth == clientWidth`); **axe light AND dark** gate the table + form via `a11y.spec` (a template is seeded so the table markup is scanned, in both schemes). |
| Input validation & secrets | ✅ | No new inputs, no schema change; existing save-time filtering (blank/zero lines) unchanged; no new field validation added; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | UX spec (`Implemented` + §8) · `07_NFR` §1³ · roadmap (row + focus + §5 changelog) · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 427 | 427 | +0 (`TemplatesView.test`'s 2 specs re-pointed in place — table roles, `Name` label, "Delete {name}"; no net new unit tests) |
| E2E | 110 | 111 | +1 (a new **dark-mode** Templates axe scan; the light Templates scan + `templates.spec` were re-pointed in place and now seed a template so the table markup is covered) |

## 4. Design notes / small calls

- **Module split (watch-out §3).** The **table** reuses `Ledgers.module.css` **verbatim** — the
  kickoff asked to "reuse the UXR3 treatment," and a third near-duplicate would fight that. The
  **form-layout pattern** is the genuinely new, reusable part, so it gets **its own new module,
  `FormLayout.module.css`**, that UXR5/UXR7 import (the spec §3 pattern, specced once). Net: Templates
  imports two modules (table treatment + form pattern); no UXR3 file's structure was touched.
- **The `.numeric` right-align fix (in passing, disclosed).** Verifying alignment live, I found money
  rendering **left-aligned** on the Templates Total column — and then confirmed the **same on the
  live UXR3 Accounts Balance column**. Cause: `.table th, .table td { text-align: left }` (specificity
  0,0,1,1) silently beats a bare `.numeric` (0,0,1,0), so `.numeric`'s `text-align: right` never
  applied to a cell — despite the CSS comment (and UXR3's report) claiming right-aligned. Fixed by
  scoping it `.table .numeric` (0,0,2,0 > 0,0,1,1). This corrects the **three Done UXR3 tables** to
  their documented intent as well as satisfying UXR4 §2 ("money right-aligned") — the alternative
  (right-aligning only Templates) would have fractured the shared treatment. No test asserts
  alignment, so nothing broke; flagged here because it changes the rendered look of Done pages.
- **`exact:true` on "Name" (e2e).** Playwright's `getByLabel` is substring by default, so `"Name"`
  matched the new **"Re*name* {template}"** action buttons once templates existed in the shared e2e
  store. `{ exact: true }` scopes it to the field — the same `exact` lesson UXR3 hit with table
  captions. testing-library's `getByLabelText` is exact by default, so units were unaffected.
- **Header row `aria-hidden`.** The line-grid's visual column headers (Envelope · Amount) are
  `aria-hidden`; the per-control `aria-label`s ("Template envelope N", …) carry the semantics, so the
  headers stay visual affordances without doubling the screen-reader announcement.
- **No new validation.** §3.5 allows field-level `FieldError`, but the template editor has no
  field-level validation today (blank/zero lines are filtered at save; failures are form-level). To
  keep behavior byte-for-byte, none was added — the form-level `role="alert"` stays above the action
  row. A first consumer that *needs* field errors (UXR5/UXR7) can add `FieldError` on the same pattern.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Two flaky e2e tests (`spend by envelope`, `transfers` delete) | Pre-existing cold-start/timing flakes carried since UXR2 — **not UXR4 code**; pass on isolated retry | Not blocking; watch |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR4) | Owner |
| Retrofitting older forms onto the pattern | UXR4 only builds the pattern + applies it to Templates; existing forms (Add account, Add transaction, Move money) are restyled by their own slices (UXR7 does Move money) — not a blanket sweep | Per-slice (UXR5/UXR7) |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); it starts its own
  throwaway-store server. Kill any dev/preview server on those ports first. Note the e2e store is
  **shared across the whole run**, so entities created by earlier specs (e.g. the a11y Templates
  scans) are visible to later ones — hence `exact:true` on ambiguous substring labels.
- **Two form-facing modules now.** Tables → `Ledgers.module.css` (shared with the 3 Ledgers pages);
  **forms → `FormLayout.module.css`** (the reusable pattern — import it for UXR5/UXR7, don't rebuild).
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr4-templates-page.md — its
  "Resume here" has state (UXR4 is Done; gate green at 427 Vitest + 111 e2e, build 124.47 KB gz;
  two known pre-existing e2e flakes noted in §5, not blocking).
- Read docs/03_ROADMAP.md — the next item is UXR5 (Recurring page), gated by UXR4 (Done). UXR6
  (Insights IA) has no pattern dependency and may run in parallel — confirm which the owner wants.

Next milestone: UXR5 — Recurring page. Restyle the recurring-rule FORMS onto the UXR4 form-layout
pattern (import docs/ux/templates-page.md §3 / apps/web/src/FormLayout.module.css — do NOT rebuild the
pattern), and re-format the rules LIST for readability. Spec of record: docs/ux/recurring-page.md
(Proposed). Owner-ratified additions already in the spec: (a) rule DELETE gains the UX12 ConfirmDialog;
(b) Payee surfaced as a column (captured today but never rendered). Confirm the exact list shape with
the owner if the spec leaves it open (the spec floats "table with the carried split as
secondary/expandable per-row disclosure").

Watch out for: (1) reuse FormLayout.module.css as-is — UXR5 is the first proof the pattern is reusable
"without new pattern code" (UXR4 §6); if you find yourself adding pattern CSS, stop and reconcile with
the pattern. (2) the split/allocation editor keeps its behavior — presentation only over the existing
recurring reads/flows, EXCEPT the two ratified additions (delete-confirm, Payee column). (3) the shell
owns the <h1> (UXR1); content headings start at <h2>. (4) list-as-table: <th> scope semantics ·
per-row accessible names · UX15 reflow (.table-scroll, 320px) · axe light AND dark (seed a rule so the
list markup is scanned, both schemes — mirror a11y.spec's scanTemplates). (5) e2e that drives Recurring
(recurring.spec, setup.ts helpers) will need re-pointing; watch Playwright getByLabel substring traps
(use exact:true) now that the store carries more named controls. (6) demo data: npm run db:reset
--workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change (UX spec → Implemented, NFR bundle
delta, roadmap); and at the end leave the project handoff-ready with the next-session kickoff prompt
(for UXR6/UXR7/parallel next item) in the status report. Provide a single-line short commit message;
I will review and commit when ready.
```
