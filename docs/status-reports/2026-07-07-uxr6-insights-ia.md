<!--
STATUS REPORT — UXR6 (Insights IA). A higher-risk slice than UXR3–UXR5: an IA RESTRUCTURE of the
Insights chrome, not a form/table restyle. The flat nine-link sub-nav becomes a two-row category IA
(five category tabs + a segmented sub-view row). NON-NEGOTIABLE and delivered: every /insights/:view
URL is preserved (a routing.spec sweep proves all nine). Presentation-only — no data/API/view change.
Newest report = the live handoff + launch pad for UXR7 (the last UX Redesign build).
-->

# Status Report — 2026-07-07 (UXR6 — Insights IA)

| Field  | Value                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------ |
| Status | Snapshot                                                                                                |
| Date   | 2026-07-07                                                                                              |
| Author | Claude (with the owner)                                                                                 |
| Scope  | UXR6 built + `Done`; delta since [2026-07-07-uxr5-recurring-page.md](2026-07-07-uxr5-recurring-page.md) |

**Resume here:** **UXR6 is `Done`** — the Insights information architecture is rebuilt
**presentation-only**. The flat nine-link sub-nav (`<nav aria-label="Insights views">`) becomes a
**two-row category IA** in [`AnalysisSection.tsx`](../../apps/web/src/AnalysisSection.tsx): a
`CATEGORIES` map (**Spending · Budget · Cash flow · Debt · Net worth**) drives a **primary**
`<nav aria-label="Insights categories">` of five category `<Link>`s (each targets its category's
default sub-view; marked `aria-current="page"` for **any** view within its section — weight + a
bottom-edge bar), and a **secondary** `<nav aria-label="{Category} views">` of the active category's
sub-views as `NavLink`s (`end`), rendered **only when the category has > 1 view** (Cash flow · Net
worth get no segment row). **Deliberately links, not ARIA tabs** — these are real routes (ADR-0006/UX3),
so back/forward, deep links, and refresh keep working. **The non-negotiable is delivered: every
`/insights/:view` URL is preserved** — the `/insights` index redirect, unknown → `spend`, and
`/insights/pay-periods` → `/pay-periods` all carry unchanged; a **new `routing.spec` sweep deep-links
all nine views** and asserts each renders + marks the right category current. Two labels read better
under their category — `spend` → **By envelope**, `budget` → **vs Actual** — but this is **nav-label
only**: routes and each view's own `<h2>` ("Insights — …") are **untouched**, so every a11y/cockpit
`level: 2` heading assertion and every cockpit `/insights/*` href is unaffected (Cockpit tests needed
**no** change). CSS: the UX15 `.subnav` is superseded by `.categoryNav` + `.segmentNav` (both wrap,
≥ 24px targets, no 320px page scroll). Gate **green** — **431 Vitest + 121 e2e** (+4 unit: the
rewritten `AnalysisSection.test`; +9 e2e: the nine-URL preservation sweep); build **125.15 KB gz**
(+0.19 vs 124.96; ~14.9 KB under the 140 KB budget). **No pattern/CSS dependency on UXR5** — this was
Insights chrome, not forms/tables. **Next: UXR7 (Manage form) — the last UX Redesign build; §7 kickoff.**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Sub-nav → two-row category IA | `CATEGORIES` map drives a primary category row + a secondary segment row (only when > 1 view). Category link current by **section** (any view in it); segment link current by **exact URL** | [`AnalysisSection.tsx`](../../apps/web/src/AnalysisSection.tsx) |
| Links, not ARIA tabs (a11y call, §4) | Two labelled `<nav>` landmarks of `<Link>`/`NavLink` + `aria-current="page"` — the ADR-0006/UX3 routing stance (deep-link/back-forward/refresh), same rationale the old sub-nav already used | [`AnalysisSection.tsx`](../../apps/web/src/AnalysisSection.tsx) |
| URL preservation (the non-negotiable) | All nine `/insights/:view` URLs + the three redirects carry byte-for-byte; category/segment derive purely from `:view`. A `routing.spec` sweep proves each of the nine | [`routing.spec.ts`](../../e2e/routing.spec.ts) |
| Label renames (nav-only) | `spend` → **By envelope**, `budget` → **vs Actual** (owner-ratified). Routes + view `<h2>`s untouched → zero ripple to heading/href assertions | [`AnalysisSection.tsx`](../../apps/web/src/AnalysisSection.tsx) |
| CSS: `.subnav` → `.categoryNav` + `.segmentNav` | Both wrap with ≥ 24px targets; active = weight + a non-colour marker (category = edge bar; segment = underline). Supersedes the UX15 `.subnav` | [`Insights.module.css`](../../apps/web/src/Insights.module.css) |
| UX spec → Implemented | `docs/ux/insights-ia.md` promoted + §8 "as built" added | [UX spec](../ux/insights-ia.md) |
| Tests | `AnalysisSection.test` rewritten (five category tabs · segment-row-only-when->1 · renamed labels · category current on a non-default sub-view · single-view no segment row). e2e: `openAnalysis` walks category → segment (label→category map); `analysis.spec`'s cross-category "→ Forecast" switch re-pointed to the Cash flow category tab; `routing.spec` +9 sweep; `cockpit.spec`/`envelopes.spec` re-pointed ("Budget" → "vs Actual") | unit + `e2e/` |
| Docs | UX spec → `Implemented` (+§8); `07_NFR` §1³ bundle delta; roadmap (row `Done` + focus + next-front + §5 changelog); this report | this change |

## 2. Definition of Done — current state (a presentation-only IA restructure)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Insights renders as five category tabs with a segmented sub-view row; every analysis view opens from the category IA and every old URL/deep-link still lands on it — verified live via the full e2e drive (`analysis.spec` opens all nine views through `openAnalysis`; `routing.spec` deep-links all nine). No data/API/view change — the same views behind new chrome. |
| Gate green | ✅ | typecheck · lint · format · unit · build · SCA all **pass** — **431 Vitest + 121 e2e**, build **125.15 KB gz**, audit clean at `--audit-level=critical` (3 pre-existing *high* advisories below the critical gate threshold). Two mid-run failures were **my own** stale call sites (`cockpit.spec`/`envelopes.spec` still passing "Budget") — fixed and re-run green; see §4. |
| Acceptance criteria met & tested (UX §6) | ✅ | Any old `/insights/:view` renders the same view with the correct category + segment active (routing sweep, all nine); a single-view category renders no segment row (`forecast` test); `/insights` + unknown → `spend` carried; renamed labels **By envelope**/**vs Actual** appear; view content + data-table fallback unchanged; axe light+dark; 320px wrap. |
| A11y (WCAG 2.2 AA) | ✅ | Two labelled `<nav>` landmarks with distinct names ("Insights categories" · "{Category} views"); active = `aria-current="page"` + weight + a non-colour marker (edge bar / underline); keyboard order = visual order; **links not ARIA tabs** (routes — §4). **axe light AND dark** across every view under the new nav (`a11y.spec`), and the **320px reflow** test confirms the two-row bar forces no horizontal page scroll. |
| Input validation & secrets | ✅ | No inputs, no schema change; the nav is static and derives from the URL param only; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | UX spec (`Implemented` + §8) · `07_NFR` §1³ · roadmap (row + focus + next-front + §5) · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 427 | 431 | +4 (`AnalysisSection.test` rewritten from 3 → 7 specs: five category tabs, segment-row-only-when->1, renamed labels, category active on a non-default sub-view, single-view no segment row, plus the two carried navigate/fallback specs) |
| E2E | 112 | 121 | +9 (`routing.spec` gains a data-driven sweep — one test per `/insights/:view`, asserting the view heading, the preserved URL, and the correct category tab's `aria-current`; every other Insights spec re-pointed **in place**, no net change there) |

## 4. Design notes / small calls

- **Links, not ARIA tabs (the flagged a11y decision — watch-out §3).** The kickoff asked whether the
  new chrome should be a real `tablist`/`tab`/`tabpanel` or a nav of links. I kept **links** — the
  spec's §3 call, and I agree: Insights is URL-addressable (ADR-0006/UX3), so back/forward, deep links,
  refresh, and the cockpit's `/insights/*` links must all keep working, which the ARIA tab pattern (a
  single-page widget with `aria-selected` + JS-managed panels) actively fights. Two labelled `<nav>`
  landmarks of links + `aria-current="page"` is the honest, standards-fit shape, and it's exactly what
  the old sub-nav already was — this slice reorganizes it into two rows, it doesn't change its kind.
- **Category link = `<Link>` with a computed `aria-current`, not a `NavLink`.** A category represents a
  **section**, so it must read as current for *any* view it contains (Spending is current on `spend`,
  `breakdown`, or `trends`) — but its `href` points at the section's **default** view. `NavLink`'s
  active match is exact-URL, which would only light the category on its default view. So the category
  links are plain `<Link>`s with `aria-current` computed from category membership; the **segment** links,
  which map one-to-one to a URL, stay `NavLink`s (`end`). Disclosed trade-off: a category link carries
  `aria-current="page"` while on a non-default sibling even though its `href` is the default — standard
  for sectioned nav, and the alternative (no current marker on the section) is worse.
- **The renames are nav-label only — zero heading/href ripple (watch-out §2).** "By envelope"/"vs
  Actual" are the *tab* labels; each view's own `<h2>` text ("Insights — spend by envelope", "Insights —
  budget vs. actual") is **unchanged**, as are all routes. That's why the a11y + cockpit `level: 2`
  heading assertions and the cockpit `/insights/budget`|`/networth`|`/forecast` hrefs needed **no**
  change (Cockpit tests are href-based and untouched).
- **Two of my own call sites went stale — caught by the full e2e, fixed, re-run green (disclosed).** I
  re-pointed `openAnalysis`'s renamed labels in `analysis.spec`/`a11y.spec` but initially missed two
  callers in **other** spec files (`cockpit.spec:74`, `envelopes.spec:50`) still passing the old
  "Budget". The rewritten helper **throws on an unknown label** (a deliberate loud-failure guard, not a
  silent skip), so the full suite failed fast and named both. Fixed ("Budget" → "vs Actual") and re-run
  green. The loud throw is why this surfaced as 2 clean deterministic failures rather than a confusing
  timeout — kept as designed.
- **Cross-category switch in `analysis.spec` re-pointed.** One test switched from the Budget view
  "straight to Forecast" by clicking a flat "Forecast" link (R3's no-return-to-dashboard point). Under
  the category IA, Forecast is the **Cash flow** category's single view, not a Budget sibling — so the
  click now targets the always-present **"Cash flow" category tab** in the primary row. Same intent
  (switch in place, no dashboard round-trip), correct new affordance.
- **No pattern/CSS dependency on UXR5 (watch-out §5).** This slice touched only Insights chrome
  (`AnalysisSection.tsx` + `Insights.module.css`) — it neither imports nor changes `FormLayout.module.css`
  or `Ledgers.module.css`. UXR7 still reuses the form pattern independently.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR6) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR6 code | Not blocking; watch |
| UXR7 (Manage form) | The last UX Redesign build — the Move-money form onto the twice-proven pattern (import `FormLayout.module.css`). §7 kickoff | Next session |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); kill any dev/preview
  server on those ports first. The e2e store is **shared across the whole run**, so `exact:true` on
  ambiguous substring labels.
- **`openAnalysis(page, view)` now walks the category IA** — pass the **sub-view** label (the renamed
  **"By envelope"** / **"vs Actual"** for spend/budget); the helper's `INSIGHTS_NAV` map clicks the
  category tab, then the sub-view when the category has siblings, and **throws on an unknown label** (so
  a stale call site fails loudly, not silently). Add a category's map entry if you add a view.
- **Two Insights CSS surfaces are distinct:** the **nav chrome** is `.categoryNav`/`.segmentNav` in
  `Insights.module.css`; the view tables/figures live in the same file below. Forms →
  `FormLayout.module.css`; ledger tables → `Ledgers.module.css` (unchanged by UXR6).
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr6-insights-ia.md — its
  "Resume here" has state (UXR6 is Done; gate green at 431 Vitest + 121 e2e, build 125.15 KB gz;
  the two pre-existing e2e flakes are watch-only; §4 logs two of my own stale call sites the loud
  openAnalysis guard caught and I fixed).
- Read docs/03_ROADMAP.md — UXR7 (Manage form) is the last UX Redesign build; after it the
  UXR1–UXR8 track is complete.

Next milestone: UXR7 — Manage page (Move-money form). Spec of record: docs/features/manage-move-money.md
(FEAT note, §11-compressed). Re-lay the Move-money form on the now-TWICE-PROVEN form-layout pattern by
IMPORTING apps/web/src/FormLayout.module.css (UXR4 established it; UXR5 proved it reuses — the rule form
imports it + the one `.fieldRow` pair-row addition). This is a LOW-RISK polish slice (a form restyle
over the existing Manage/Move-money reads/flows), not an IA or data change — the opposite risk profile
to UXR6.

Watch out for: (1) presentation-only — NO data/API/domain change; the Move-money flow (source/dest
envelope, amount, submit) stays byte-for-byte, only its framing adopts the pattern. (2) reuse by
IMPORT — don't rebuild the pattern; import FormLayout.module.css (fieldset/legend · Field/Input/Select
primitives · `.fieldRow` gridded pairs if natural · right-aligned action row). Confirm whether Manage's
fields have natural pairs (→ `.fieldRow`) or stack. (3) the shell owns the <h1> (UXR1); confirm
ManageView's heading level + name and whether any test asserts it. (4) axe light AND dark; 320px reflow.
(5) check ManageView.test + the manage e2e spec (if any) for what they assert, and re-point in place.
(6) demo data: npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api.

Confirm, in your own words, where things stand and the plan before building — this one is low-risk, so
the confirmation can be brief. Keep it vertical and gate-green; update docs in the same change (FEAT
note → Implemented, NFR bundle delta, roadmap); and at the end leave the project handoff-ready. With
UXR7 done the UXR1–UXR8 track closes — note the remaining alternatives (#17/#18 history import; #19/#20
deferred) in the status report. Provide a single-line short commit message; I will review and commit
when ready.
```
