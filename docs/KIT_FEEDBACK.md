<!--
KIT FEEDBACK — a running log of improvements to the *baseline starter kit* discovered while
building Budgeteer. This is feedback FROM this project TO the kit (distinct from ORIGIN.md, which
records the kit's founding lessons from the prior project). Append as new lessons surface; when we
do the kit pass, each row becomes a concrete change to the baseline.
-->

# Kit feedback — improvements discovered building Budgeteer

> **Kit pass done (2026-06-21):** all items below (K1–K16) were folded into the canonical
> baseline (`/Users/wesker/DrewskiLabs/Docs/baseline-starter`, repo `wes-cutting/baseline-starter`)
> on branch **`kit-pass/from-budgeteer-2026-06-21`** — in **process/template/doc** form, since the
> baseline is stack-agnostic; the code-harness items (K2/K3/K10/K11) ship there as requirements +
> a pointer to this project as the reference implementation. That branch is **uncommitted/unpushed**
> pending review. The new `ENGINEERING_STANDARDS §4` patterns + `TESTING_STRATEGY` sections were
> also backported here so Budgeteer matches the improved baseline.

| Field   | Value                                                       |
| ------- | ---------------------------------------------------------- |
| Status  | Living                                                     |
| Owner   | Wesley Cutting                                             |
| Purpose | Capture baseline-kit improvements found while building a real project, for a later kit pass. |
| Related | [`ORIGIN.md`](../ORIGIN.md) (kit's founding lessons) · [`reviews/2026-06-15-repo-review.md`](reviews/2026-06-15-repo-review.md) · EH1–EH6 in [`03_ROADMAP.md`](03_ROADMAP.md) · [`status-reports/2026-06-21-16.md`](status-reports/2026-06-21-16.md) (a11y/perf/CI) · 2026-06-21 docs/kit-pass review |

## How to use this

Each item is something the **kit itself** should change so the *next* project doesn't hit it.
Priority is the kit-impact, not this project's. "Source" is where it surfaced here.

## Open items

| # | Priority | Kit improvement | Source | Recommendation |
| - | -------- | --------------- | ------ | -------------- |
| K1 | High | **CI gate skeleton auto-fails from commit zero.** `.github/workflows/gate.yml` ships with `on: [pull_request, push]` **and** a `gate-not-configured` `exit 1` guard. So until someone wires it, every push/PR shows a red check — pure noise on a solo / early / local-first project, and it trains people to ignore CI. | This request | Default the shipped workflow to **`workflow_dispatch`** (manual) — or ship the triggers commented out — with a one-step "enable CI" note. Keep the `exit 1` guard so it can't false-green once enabled. (Applied here: switched to `workflow_dispatch`-only.) |
| K2 | High | **Documented gate ≠ runnable gate.** `ENGINEERING_STANDARDS` §2 (DoD) and `gate.yml` both list **lint** and **e2e (incl. a11y)**, but the scaffold shipped **no** ESLint config and **no** e2e harness. Result: items the DoD claims are silently deferred for many slices (lint until EH4; e2e until EH5) — a "false-certainty" cousin where the gate doc overstates enforced rigor. | EH4, EH5 | Ship a **working minimal ESLint flat config** wired to `npm run lint`, and a **minimal e2e harness** (one real browser→API smoke), from commit zero — so "the gate" is real on day one and the DoD isn't aspirational. **(Both gaps now closed in Budgeteer: lint in EH4, e2e in EH5 — but late, as retrofits. The kit should ship them from commit zero.)** |
| K3 | High | **Testing strategy misses the real browser→API path.** The kit's three layers (domain unit · API integration via inject · component/jsdom with a fake API) never exercise a real browser hitting the real API. A CORS misconfig shipped and was only caught by manually running the app. | CORS bug → EH5 | `TESTING_STRATEGY` should require a **minimal real-browser smoke** (e.g. Playwright: app loads + one journey against the running API) in the **foundation**, not deferred to hardening. The kit even names this risk (front-load risk) but the test layers didn't cover it. **(Applied here in EH5: a Playwright Chromium e2e — dashboard-loads-vs-real-API + one account→envelope→allocate journey — is now a `npm run test:e2e` gate step. Port the harness shape to the kit's scaffold so it ships on day one.)** |
| K4 | Med | **No "single source of truth" guard for the pure core in the UI.** The scaffold let the web reimplement domain money/format/date logic (a duplicated penny-exact regex) because the domain package wasn't wired to be consumed by the web. | EH1 | Wire the pure-core package into **both** api and web in the example (workspace dep + bundler-consumable exports), and add an explicit boundary rule: **"presentation imports the domain; never reimplement domain logic in the UI."** Distinguish domain (plain-decimal) from presentation (locale/currency) formatting in the example. |
| K5 | Med | **Service-layer plumbing duplicates by default.** Example services each re-derived date converters and a "group children by parent id" loop, and coupled a constant (`DEFAULT_HOUSEHOLD_ID`) to the **migration module**. | EH2 | Ship a tiny `util/` (dates, `groupBy`) and a neutral `constants.ts` convention in the scaffold, plus a note: **don't couple app constants to the migration module.** |
| K6 | Med | **API example lacks two correctness defaults.** A DB unique-constraint violation surfaced as a **500** (the real guard's failure unhandled), and routes used `req.params as {…}` casts (a typed-assertion escape hatch the standards otherwise forbid). | EH3 | The kit's HTTP example should ship **typed route params** (framework generics) and a **DB-error → domain-error shim** (unique-violation → 409) as the default — tie it to the "consistent error envelope" recommended pattern. |
| K7 | Low | **Gate commands live in 3+ places.** README table, `ENGINEERING_STANDARDS`, and every status report restate the gate commands; keeping them in sync is manual (this project drifted — README omitted `lint` until EH4). | EH2–EH4 | Point all references to **one canonical gate-commands list** (e.g. the README table), or generate them, so adding a gate step is a one-place edit. |
| K8 | Low | **Status-report filenames collide within a day.** Multiple reports per day share the date prefix (`2026-06-15-eh{1..4}`). Minor, but the template implies one-per-day. | EH1–EH4 | Document a within-day suffix convention (we used `-<item>`); note it in the status-report template. |
| K9 | Med | **Handoff needed a per-milestone kickoff prompt.** The kit had a *generic* resume prompt (`KICKOFF-PROMPT.md`) but no per-milestone, paste-ready prompt naming the next item, its risks, and any new setup — so a fresh context window had to re-derive the next step. | This request | **Applied here & port to kit:** status reports now end with a "Next-session kickoff prompt" (§7 of the template); `00_WAYS_OF_WORKING.md` §9 + `CLAUDE.md` require, at each milestone, that the project is handoff-ready and the report carries that prompt. The newest report becomes both handoff and launch pad. |

## Open items — added in the 2026-06-21 kit pass (later slices: analysis · #16 · R-series · docs review)

| # | Priority | Kit improvement | Source | Recommendation |
| - | -------- | --------------- | ------ | -------------- |
| K10 | High | **WCAG 2.2 AA is mandated but unverifiable out of the box — the first real scan found violations.** The DoD requires AA on user-facing surfaces and `TESTING_STRATEGY` names an "accessibility scan" e2e layer, but the scaffold ships no a11y harness and no baseline a11y CSS. `#16`'s first axe-core scan found **2 serious violations from defaults**: `target-size` (WCAG 2.5.8 — browser-default `button`/`input`/`select` heights ~19–21px < 24px) and `dlitem` (a `<dl role="status">` breaking `<dt>/<dd>` containment). | `#16` | Ship from commit zero: (a) an **axe-core e2e harness** (`e2e/a11y.spec.ts` shape — `withTags(wcag2a/2aa/21aa/22aa)`, fail on serious+critical) and (b) a minimal **`index.css` accessibility floor** (`min-height:24px` on `button`/`input`/`select`). Makes the AA mandate enforced day-one instead of discovered late. |
| K11 | Med | **Perf budgets are documented but never measured.** The NFR template carries a perf-budget table, but nothing asserts against it, so budgets stay aspirational until someone builds a harness (here, `#16`). | `#16` | Ship a **perf-test pattern** (`apps/api/test/perf.test.ts` shape: seed realistic volume, assert p95 per heaviest read path) wired to the NFR template's budget table, so "budget" means "measured." Aligns with `ENGINEERING_STANDARDS §5` ("assert against realistic data volumes"). |
| K12 | Med | **The kit should ship `KIT_FEEDBACK.md` itself.** This fold-back is only possible because lessons were captured as they surfaced — but `docs/KIT_FEEDBACK.md` was invented in this project; `baseline-starter` ships nothing equivalent, so the next project starts without the capture habit. | This pass | Add `docs/KIT_FEEDBACK.md` (this file, reset to a stub) to the baseline + a one-line pointer in `CLAUDE.md` / `00_WAYS_OF_WORKING.md §9`: *capture kit-level friction here as it surfaces, for a later kit pass.* (Meta-improvement.) |
| K13 | Med | **The derived read-model + config-store shapes recur and should be named patterns.** Five analysis slices (`#11`–`#14b`) all took the same shape — a **pure-domain function + thin read service + thin view, no stored aggregate** — and three config stores (`envelope_targets`/`credit_limits`/`loan_principals`) were structurally identical (one reference number per owner, set/clear, service-boundary kind-check). | `#11`–`#14b` | Add to `ENGINEERING_STANDARDS §4`: a **"derived read-model"** pattern (analysis = pure function over existing rows; don't store rollups — reinforces derive-don't-store) and a **"reference/config store"** micro-pattern, with the analysis area as the worked example. |
| K14 | Low | **Overview/summary prose and internal links rot while detailed sections stay correct.** The 2026-06-21 review found: data-model §1 "five tables" (→15), a §4 `server/migrations/` path that never existed, a dangling `FEATURE_BREAKDOWN.md` ref, a README status blurb listing shipped work as "ahead," and a **broken roadmap link** to a non-existent `reviews/2026-06-17-improvement-review.md`. The doc-status ladder governs spec *lifecycle* but nothing guards summary-line drift or link integrity. | This pass | Make "docs updated in the same change" (DoD) explicitly include **overview/intro lines and internal links**; add an optional **link-check** to the gate. Note in `00 §10` that summary sentences are the first to rot. |
| K15 | Low | **"Endpoint done" leaked into horizontal work — API shipped without client/UI.** `R1`/`R7` found `PATCH /accounts/:id` and the account-archive endpoints fully implemented + tested but with **no `api.ts` client method and no UI** — a vertical slice that quietly stopped at the API. | `R1`, `R7` | In the feature-spec/DoD, state that a slice's acceptance includes the **client binding + a UI surface** (or an explicit, logged deferral) — so "done" can't mean API-only. A concrete check that reinforces vertical-slices. |
| K16 | Low | **Recurring e2e selector footgun.** `R1` hit Playwright's `getByRole("button", { name })` matching a substring of a sibling's `aria-label`; the fix is `exact: true`. | `R1` | Once the kit ships the e2e harness (K2/K3), add an **e2e-conventions note**: prefer `exact: true` for role-name queries when the name appears inside another element's accessible name. |

## Open items — added from the [2026-07-02 architecture review](reviews/2026-07-02-architecture-review.md)

| # | Priority | Kit improvement | Source | Recommendation |
| - | -------- | --------------- | ------ | -------------- |
| K17 | High | **"Time is a dependency" needs a worked pattern, not just a mention.** `ARCHITECTURE §1` names the clock as I/O, and this project's *domain* honoured it (`today` passed as a parameter) — but the *service* layer still grew `new Date()` helpers, producing a calendar-dependent test that failed on `main` for weeks (EH7). The kit states the rule but ships no shape for the shell side, so the erosion happened one layer up from where the rule was watched. | EH7 | Add to `ENGINEERING_STANDARDS §4`: an **injected-clock pattern** (`buildServer(deps, { now?: () => Date })` threaded to service factories; tests pass a fixed date; fixtures use absolute dates). One line in `TESTING_STRATEGY`: relative-date fixtures against the real calendar are a smell. |
| K18 | Med | **"Prefer lint-enforced boundaries" ships no lint.** `ARCHITECTURE §2` says to enforce the layer rules with module-boundary tooling, but the kit provides no example config — so boundaries stay convention until a review checks them (EH13; EH1 was the same erosion caught earlier by hand). | EH13 | When K2 ports the ESLint config, include a commented **per-zone `no-restricted-imports`** block (domain bans framework/datastore/UI imports; presentation bans the datastore client; route modules ban direct db access) as the starting shape. |
| K19 | Med | **Calendar-date semantics are an undeclared fork every app with dates hits.** Dates were correctly *modeled* as `YYYY-MM-DD` strings, but *deriving* "today"/"this month" defaulted to UTC on both server and client — shifting every user-facing default for anyone west of UTC (EH8). Nothing in the kit prompts the decision, so the default was made silently, eight components deep. | EH8 | Add a prompt to `templates/DOMAIN-MODEL-TEMPLATE.md` (and the discovery guide's data questions): **"In whose timezone is a calendar date derived, and which layer derives it?"** — suggesting the client-derives-local / server-never-derives default. |
| K20 | Med | **`reuseExistingServer` silently invalidates empty-state e2e assertions.** The e2e config reuses a dev server already holding the ports "for local convenience" — but the suite's first-run/onboarding specs assert against a *genuinely empty* store, so a running dev stack (with real data) fails 6 a11y specs in a way that looks like an app regression, not an environment problem (hit during the EH8 gate run; the clean re-run was 94/94). | EH8 gate run | When the kit ships the e2e harness (K2/K3): either set `reuseExistingServer: false` for suites with empty-state assertions, or have the config **fail fast with a clear message** when the port is already held — "e2e needs to own the stack; stop the dev server on :PORT first" beats a confusing partial failure. |

## Kit-pass readiness (2026-06-21)

**K1–K3 (the "make the gate real" cluster) are now validated — port the proven artifacts, not just the advice.** `#16` wired CI (`gate.yml`, deliberately kept `workflow_dispatch`), confirming K1's call; lint (EH4) and the Playwright e2e layer (EH5 → R14: per-area specs + `e2e/setup.ts`) are mature, closing K2/K3. The pass should copy the *actual shapes* into the scaffold:
`.github/workflows/gate.yml` (workflow_dispatch + 7 wired steps incl. SCA `npm audit --omit=dev --audit-level=critical`) · `eslint.config.js` (flat) · `playwright.config.ts` + `e2e/setup.ts` · `e2e/a11y.spec.ts` · `apps/api/test/perf.test.ts` · `apps/web/src/index.css`.

**K4–K9 remain as written; none are in `baseline-starter` yet** (it is still at the founding commit `c8e994b`). They were applied in-project and need porting to the scaffold/templates.

**Suggested port order (highest leverage first):**
1. **Gate-real-from-zero:** K1, K2, K3, K10, K11 (CI triggers + lint + e2e + a11y + perf harnesses, all wired).
2. **Example-code defaults:** K4, K5, K6, K13 (shared pure core, `util/` + neutral `constants.ts`, typed route params + DB-error→409 shim, read-model/config patterns).
3. **Process & docs:** K9, K12, K14, K15, K7, K8, K16.

## Notes for the kit pass

- The **highest-value** cluster (K1–K3) is all the same theme: **the kit should make the gate it
  documents actually runnable and actually exercised from commit zero** — CI that doesn't auto-fail
  before it's wired, lint that exists, and a test layer that covers the browser→API seam. This is the
  "False-Certainty Docs" anti-pattern ([`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) §10) applied
  to tooling rather than specs.
- K4–K6 are **example-code defaults**: the scaffold's sample app shaped how this project's code grew;
  shipping the good pattern (shared core, extracted utils, typed params + error shim) by example is
  cheaper than retrofitting it as "engineering-health" slices later (which is exactly what EH1–EH3
  were).
