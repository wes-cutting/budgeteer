<!--
NFR / OPERATIONAL-READINESS — hardening track for Budgeteer. The non-functional requirements
and operational readiness the app must meet. Created alongside #15a (backup/export), the first
hardening item; extended by #16 (a11y pass + perf/NFR budgets + CI gates).
Adapted from templates/NFR-TEMPLATE.md.
-->

# Non-Functional Requirements & Operational Readiness — Budgeteer

| Field        | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Status       | Active                                                                  |
| Owner        | Wesley Cutting                                                          |
| Last updated | 2026-07-06                                                              |
| Sources      | [`SECURITY.md`](SECURITY.md) · [`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) · [`ADR-0003`](adr/ADR-0003-money-integer-minor-units.md) · [`03_ROADMAP.md`](03_ROADMAP.md) `#15a`/`#16` |

> **Measure before optimizing.** Every budget must be verified against a realistic data
> volume — not an empty dev database. An unmeasured target is a guess.

---

## 1. Performance budgets

Targets for the critical read paths. Measured against synthetic (never real) data volumes.
All three API endpoints verified by `apps/api/test/perf.test.ts` (#16). Web LCP measured
via `vite build` + Lighthouse audit (#16, developer machine: Apple M-series, local server).

| Journey / operation | Budget | At volume | Measured p95 | How verified |
| ------------------- | ------ | --------- | ------------ | ------------ |
| `GET /accounts` (account list) | < 50 ms p95 | 50 accounts | **0.9 ms** | `apps/api/test/perf.test.ts` · Fastify `inject` against PGlite |
| `GET /analysis/envelope-spend` (monthly grid) | < 200 ms p95 | 10 envelopes × 120 txns¹ | **3.4 ms** | `apps/api/test/perf.test.ts` · same |
| `GET /export` (backup snapshot) | < 500 ms p95 | 5 accounts + 5 envelopes + 200 txns | **11.5 ms** | `apps/api/test/perf.test.ts` · same |
| Web initial load (LCP) | < 2.5 s | Cold load, production build | < 1 s² | Manual Lighthouse on `vite build` output |
| Web initial JS bundle (gz) | < 140 KB gz (re-baselined 2026-07-06; was 120)³ | Production `vite build`, single chunk | **125.21 KB gz** (+ 5.21 KB gz CSS, re-measured 2026-07-07 · UXR7)³ | `npm run build --workspace @budgeteer/web` (Vite prints gzip sizes) |

> ¹ Half-scale of the original budget (2 yrs × 20 env × 100/mo = 48 000 txns); PGlite performance
>   at full scale is expected to remain well under budget given the measured p95 at half-scale.
>   Full-scale seeding takes several minutes per run — deferred until a perf regression warrants it.
>
> ² All assets are bundled into a single Vite chunk; cold LCP on localhost with a production build
>   is sub-second. No CDN or network latency in V1's local-only deployment model.
>
> ³ Budget set in `UX3` from the first shell build (SPIKE-06 follow-up). React Router added
>   ~31 KB gz over the pre-router 60.5 KB gz (UX4); `UX7`'s Radix Dialog added ~12 KB gz → 105.4 KB gz;
>   **`UX8`'s six hand-rolled charts + the shared `ui/Chart` primitive added ~2.9 KB gz → 108.33 KB
>   gz**; **`UX9`'s new `BreakdownBars` shape + the `/insights/breakdown` view added ~0.6 KB gz →
>   108.93 KB gz**; **`UX10`'s `/insights/trends` view (reuses the existing `LineChart` shape — no
>   new shape) added ~0.97 KB gz → 109.90 KB gz**; **`UX11`'s `/insights/burndown` view (reuses the
>   existing `Gauge` shape — no new shape — + one small pure domain fn) added ~1.16 KB gz → 111.06 KB
>   gz**; **`UX12`'s `ConfirmDialog` primitive (controlled/transient, on the existing Radix `Dialog` —
>   **no new dependency**) added ~0.42 KB gz → 111.48 KB gz**; **`UX12b`'s skeleton-loader swap
>   (16 bare `Loading…` strings → the existing UX4 `Skeleton` primitive — **no new dependency, no new
>   code**) net **−0.04 KB gz → 111.44 KB gz**; **`UX12d`'s inline-validation slice (a pure
>   `amountFieldError` helper + a small `FieldError` primitive wired into 4 forms — **no new
>   dependency**) added ~0.24 KB gz → 111.68 KB gz**; **`UX12c`'s success-toast slice — a new
>   `ToastProvider`/`useToast()` on **`@radix-ui/react-toast`** (the last hard a11y widget ADR-0005
>   reserved for Radix — the one UX12 thread needing a **new dependency**), wired to the
>   successful-mutation set — added **+4.63 KB gz → 116.31 KB gz** (~3.7 KB headroom, down from
>   ~8.3); **`UX13`'s money & budget-health encoding — a hand-rolled `ProgressBar` primitive on the
>   tokens + CSS (**no charting dependency**), wired into the Budget table + cockpit — added **+0.56 KB
>   gz → 116.87 KB gz**; **`UX14`'s first-run onboarding — a small `FirstRunOnboarding` component
>   (composes the existing UX4 `EmptyState`) shown on the home when the app is empty, plus the Home's
>   derived first-run check — **no new dependency**) added ~0.33 KB gz → 117.20 KB gz**; **`UX15`'s
>   responsive pass — **CSS/token-only** (media queries + one global `.table-scroll` utility on the
>   existing modules; **no new dependency, no new component**) added ~0.07 KB gz → 117.27 KB gz** now
>   (~2.7 KB headroom) — the **last UX-Uplift item**. The **< 120 KB
>   gz** budget left room for the hand-rolled SVG charts
>   (`UX2`/`UX8`–`UX11`, **no chart-lib dependency**), as the spike predicted: **[SPIKE-07](spikes/07-accessible-charting.md) /
>   [ADR-0007](adr/ADR-0007-accessible-charting.md) measured ~1.94 KB gz for the primitive** vs **Recharts
>   129 KB gz** — a charting library *alone* exceeds this whole budget, which is *why* charts are
>   hand-rolled, and the realised six-chart cost (2.9 KB) confirms it. New `--chart-1/2/3` + `--chart-grid`
>   tokens (≥ 3:1 for WCAG 1.4.11) landed with `UX8`. Post-Uplift growth (EH8's client date
>   derivation · **`S7`'s Pay-periods view, +0.97 KB**) → **118.67 KB gz**, ~1.3 KB of headroom
>   against the original 120 — the S7 status entry's predicted "next UI-bearing slice forces the
>   budget conversation." **Re-baselined 2026-07-06 (owner decision): 120 → 140 KB gz**, ahead of
>   the UX Redesign ([`UXR1`+](reviews/2026-07-06-ux-redesign-initiative.md)) — the initiative's
>   first icon set + sidebar chrome plus its per-page slices (est. +7–14 KB total) cannot fit in
>   1.3 KB. 140 funds the initiative while preserving the budget's *discipline* function:
>   dependency-class additions (an icon library, another Radix suite, any charting library —
>   Recharts alone is ~129 KB gz, still roughly this entire app) remain a deliberate conversation,
>   and per-slice costs stay logged here. The rule carries: **revisit if a slice pushes past
>   140 KB** — route-level code-splitting is the recorded lever for that conversation. No
>   code-splitting yet; a single chunk is fine at this size.
>
>   **`UXR1`'s sidebar shell (2026-07-07)** — the grouped sidebar + top bar + Radix-Dialog drawer,
>   plus **15 repo-owned lucide (ISC) SVG icons copied into `ui/icons.tsx` (no icon dependency)**
>   and the page-title context — added **+3.84 KB gz → 122.51 KB gz** (CSS +0.70 → 4.55 KB gz),
>   within the predicted ≈ +2–4 KB. No new dependency (the drawer reuses the UX7 `@radix-ui/react-dialog`).
>   ~17.5 KB of headroom remains under the 140 KB budget for the per-page redesign slices (`UXR2`+).
>
>   **`UXR2`'s pay-period planner (2026-07-07)** — the S7 view re-laid as two side-by-side ledgers
>   (client-side countdown derivation + `aria-pressed` selection highlight), the promoted
>   `/pay-periods` route + redirect, and the cockpit's Next-paycheck line — added **+1.29 KB gz →
>   123.80 KB gz** (CSS +0.30 → 4.85 KB gz). No new dependency; no new shape (the two additive API
>   fields are pure-domain). ~16 KB of headroom remains under the 140 KB budget.
>
>   **`UXR3`'s Ledgers tables (2026-07-07)** — the three Ledgers-group lists (Accounts · Envelopes ·
>   Needs allocation) re-laid as real design-system tables over one shared `Ledgers.module.css`
>   treatment, plus the Accounts page-local Add-transaction link (a `<Link>` to the existing UX7
>   route) — added **+0.29 KB gz → 124.09 KB gz** (CSS +0.08 → 4.93 KB gz). Presentation-only: **no
>   new dependency, no data/API/domain change** (the new CSS module + table JSX are the only weight).
>   ~15.9 KB of headroom remains under the 140 KB budget.
>
>   **`UXR4`'s Templates page (2026-07-07)** — the saved-templates list re-laid as a real table
>   (reusing the UXR3 `Ledgers.module.css` treatment verbatim) plus the **reusable form-layout
>   pattern** in a new `FormLayout.module.css` (fieldset/legend + the `Field` primitives + the
>   envelope/amount line mini-grid + action row — the pattern UXR5/UXR7 reuse) — added **+0.38 KB gz →
>   124.47 KB gz** (CSS +0.14 → 5.07 KB gz). Presentation-only: **no new dependency, no
>   data/API/domain change** (a new CSS module + restructured JSX are the only weight; also corrected a
>   latent `.numeric` specificity bug so money right-aligns across all four ledger/Templates tables).
>   ~15.5 KB of headroom remains under the 140 KB budget.
>
>   **`UXR5`'s Recurring page (2026-07-07)** — the rule form re-laid on the UXR4 form pattern
>   (**imported** `FormLayout.module.css`, +1 pattern-completing `.fieldRow` class it realizes for its
>   first pair-row consumer) and the rules list re-laid as a table (reusing the UXR3
>   `Ledgers.module.css` treatment verbatim) with a Payee column and the split behind a per-row
>   disclosure (a small page-local `RecurringView.module.css`); Delete gains the existing UX12
>   `ConfirmDialog` — added **+0.49 KB gz → 124.96 KB gz** (CSS +0.08 → 5.15 KB gz). Presentation-only
>   plus the two owner-ratified additions: **no new dependency, no data/API/domain change**. ~15 KB of
>   headroom remains under the 140 KB budget.
>
>   **`UXR6`'s Insights IA (2026-07-07)** — the flat nine-link Insights sub-nav re-laid as a two-row
>   category IA in `AnalysisSection.tsx` (a `CATEGORIES` map driving a primary row of five category
>   links + a secondary segmented row of the active category's sub-views, rendered only when > 1;
>   `.subnav` superseded by `.categoryNav` + `.segmentNav`) — added **+0.19 KB gz → 125.15 KB gz** (CSS
>   +0.06 → 5.21 KB gz). Presentation-only: **no new dependency, no data/API/domain change** — every
>   `/insights/:view` URL is preserved (a `routing.spec` sweep asserts all nine). ~14.9 KB of headroom
>   remains under the 140 KB budget.
>
>   **`UXR7`'s Manage form (2026-07-07)** — the Move-money form re-laid on the UXR4 form pattern by
>   **importing** `FormLayout.module.css` (fieldset/legend + the `Field`/`Input`/`Select` primitives,
>   From/To and Amount/Memo gridded as `.fieldRow` pairs stacking ≤ 640px, right-aligned action row) —
>   added **+0.06 KB gz → 125.21 KB gz** (CSS unchanged at 5.21 KB gz — **no new CSS**, the module was
>   only imported). Presentation-only: **no new dependency, no data/API/domain change** (the flow is
>   byte-for-byte; only JSX framing changed). This closes the `UXR1`–`UXR8` track. ~14.8 KB of headroom
>   remains under the 140 KB budget.

---

## 2. Capacity & scale

Budgeteer is a **single-household personal finance tool** — scale targets are intentionally
modest and sized for one household's real financial history.

- **Expected data:** 5–15 years of transactions × 1 household × 10–30 envelopes.
  Realistic upper bound: ~5 000 transactions, ~2 000 allocations, ~500 recurring lines.
- **Concurrent users:** 1–2 (household members). No multi-tenancy in V1 (#19 is the
  multi-user epic; it will add its own NFR doc section).
- **Bottleneck:** All reads are against an in-process PGlite store (single writer, reads
  share the process). Forecast and envelope-spend aggregates are the heaviest queries.
- **Synthetic test dataset** for perf tests: generated by `apps/api/test/perf.test.ts`
  via Fastify `inject` calls against an in-process PGlite instance (never real data).
  Data volumes and structure documented in the test file itself.

---

## 3. Availability & reliability

- **Deployment model (V1):** local-only — the API and web app run on the user's machine.
  No remote SLO target in V1; availability is "works when the machine is on."
- **Data integrity:** The split invariant (`Σ allocation_cents = transaction.amount_cents`)
  is enforced at the service boundary on every write (never derived by reading). The
  database schema has FK constraints enforcing referential integrity. PGlite persists to a
  local file; if the file is corrupted, the backup (`GET /export`) is the recovery path.
- **No partial writes:** every multi-step operation (e.g., account creation + opening
  transaction) runs within a Kysely transaction; partial failure rolls back.
- **Backup / restore:**
  - **`#15a` (export, done):** `GET /export` → `budgeteer-backup-YYYY-MM-DD.json`. A
    JSON snapshot of all 15 tables; integer cents as numbers; dated filename. The user can
    download on demand from the Dashboard.
  - **`#15b` (import/restore, done — EH10):** `npm run db:restore -- <file>` restores a
    snapshot into an empty store (non-destructive: `db:reset` first). Round-trip fidelity,
    FK ordering, ID handling, and schema versioning proven by
    [SPIKE-09](spikes/09-restore-roundtrip.md); the `export → restore → export`
    equivalence test keeps it proven in the gate.

---

## 4. Observability

V1 is local-only; production observability is minimal but intentional.

- **Structured logging:** Fastify logger is off by default in V1 (see `buildServer` opts).
  `R13` (roadmap) will wire `logger: true` with `pino` + a `LOG_LEVEL` env var.
- **Metrics:** No instrumentation in V1. The meaningful signal is the backup export — if it
  downloads a non-empty JSON, the data layer is alive.
- **Backup as a health probe:** `GET /export` exercises the full read path (15 table queries
  in parallel). A failing export surfaces datastore issues immediately.
- **Alerts:** Not applicable for V1 (local-only, single user). Add if the app is deployed
  remotely.

---

## 5. Security & privacy NFRs

In addition to the baseline in [`SECURITY.md`](SECURITY.md):

- **Data classification:** All data is personal financial data — household accounts,
  balances, transaction history, debt/credit figures. Treat as **confidential**.
- **Backup security:** The exported JSON contains the user's complete financial history.
  - Never committed to the repo (`.gitignore` excludes `*.json` in data directories;
    the download lands in the user's `Downloads` folder, not the repo).
  - Never logged — the `GET /export` route does not log the response body.
  - The file is unencrypted (V1); users should store it in an encrypted location.
    Encryption-at-rest is a `#15b`/post-V1 concern.
- **Tests use synthetic fixtures only** — no real financial data ever enters the test suite
  ([`SECURITY.md`](SECURITY.md) §8, [`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) §8).
- **No auth in V1** — the export endpoint (like all V1 endpoints) has no authentication.
  Multi-user auth is roadmap `#19`; when it lands, `GET /export` must be auth-gated.
- **SCA / dependency gate:** `npm audit` is not yet wired into CI. `#16` adds it alongside
  ESLint-in-CI and e2e-in-CI.

---

## 6. Accessibility

Baseline: **WCAG 2.2 AA** on all user-facing surfaces
([`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) §2). Each slice's DoD includes an
accessibility check on any new UI. `#16` is a consolidated a11y pass.

- **`#15a` — "Download backup" link:** a plain `<a href>` element with descriptive link
  text ("Download backup") — natively accessible (keyboard focusable, screen-reader
  announced). No ARIA additions needed.
- **`#16` — consolidated pass ✅ done (2026-06-21):** `@axe-core/playwright` integrated
  into `e2e/a11y.spec.ts` (12 tests, 1 per view). Two violation categories found and fixed:
  - **`target-size`** (WCAG 2.5.8 AA): browser-default `<button>`/`<input>`/`<select>`
    height was ~19–21 px (< 24 px minimum). Fixed with `apps/web/src/index.css` setting
    `min-height: 24px` on all three element types.
  - **`dlitem`** (WCAG 1.3.1 A): `<dl role="status">` in `CreditView`, `PayoffView`, and
    `ForecastView` overrode the `<dl>` semantic role, making `<dt>`/`<dd>` children
    structurally invalid. Fixed by removing the `role="status"` override (plain `<dl>`).
  All 12 a11y tests pass; zero serious/critical violations on any view.
- **Audit cadence:** `e2e/a11y.spec.ts` runs with every gate invocation (per-view axe
  scan). Manual keyboard walkthrough per new view slice thereafter.
- **Tools:** `@axe-core/playwright` (automated, WCAG 2.x AA tags), Playwright e2e.

---

## 7. Operational readiness

Pre-production checklist. Checked as items land; `#16` completes most of these for V1.

- [x] **Backup (export) available** — `GET /export` delivers a complete JSON snapshot;
  user can download from the Dashboard. (#15a done.)
- [x] **Restore (import) proven** — `npm run db:restore -- <file>` (apps/api); round-trip
  fidelity proven by [SPIKE-09](spikes/09-restore-roundtrip.md) and locked in by the
  `export → restore → export` equivalence gate test. (#15b/EH10 done.)
- [ ] **Deploy & rollback documented** — a repeatable "how to run the app" guide for V1
  (local-only: `npm run start` + `npm run dev`). Currently undocumented outside the README.
- [ ] **Config validated at startup** — `DATABASE_URL`, `CORS_ORIGINS`, and `PORT` are
  validated at boot; the process exits with a clear error if misconfigured. (deferred post-#16)
- [x] **Dependency / vulnerability gate in CI** — `npm audit --audit-level=high` wired in
  `gate.yml`. (#16 done.)
- [x] **ESLint in CI** — `npm run lint` wired in `gate.yml`. (#16 done.)
- [x] **e2e in CI** — `npm run test:e2e` wired in `gate.yml` (includes a11y scan). (#16 done.)
- [x] **A11y pass complete** — axe scan clean on all 12 views (`e2e/a11y.spec.ts`). (#16 done.)

---

## 8. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Should the backup file be encrypted (e.g. passphrase-protected zip) in V1? | Wesley Cutting | open — considered at #15b scoping (SPIKE-09), deliberately not built; revisit with `#19` |
| What is the correct FK insert order for restore? (households → accounts/envelopes → transactions → allocations → …) | Agent | **closed** — SPIKE-09 F1: explicit topological order owned by `restoreService` (the file's key order is FK-unsafe) |
| Should `GET /export` stream the response for very large datasets, or is a single JSON payload sufficient for V1 volumes? | Wesley Cutting | open — likely fine for V1 (~5 000 txns); revisit if performance budget fails |
