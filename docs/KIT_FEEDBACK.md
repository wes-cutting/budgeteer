<!--
KIT FEEDBACK — a running log of improvements to the *baseline starter kit* discovered while
building Budgeteer. This is feedback FROM this project TO the kit (distinct from ORIGIN.md, which
records the kit's founding lessons from the prior project). Append as new lessons surface; when we
do the kit pass, each row becomes a concrete change to the baseline.
-->

# Kit feedback — improvements discovered building Budgeteer

| Field   | Value                                                       |
| ------- | ---------------------------------------------------------- |
| Status  | Living                                                     |
| Owner   | Wesley Cutting                                             |
| Purpose | Capture baseline-kit improvements found while building a real project, for a later kit pass. |
| Related | [`ORIGIN.md`](../ORIGIN.md) (kit's founding lessons) · [`reviews/2026-06-15-repo-review.md`](reviews/2026-06-15-repo-review.md) · EH1–EH6 in [`03_ROADMAP.md`](03_ROADMAP.md) |

## How to use this

Each item is something the **kit itself** should change so the *next* project doesn't hit it.
Priority is the kit-impact, not this project's. "Source" is where it surfaced here.

## Open items

| # | Priority | Kit improvement | Source | Recommendation |
| - | -------- | --------------- | ------ | -------------- |
| K1 | High | **CI gate skeleton auto-fails from commit zero.** `.github/workflows/gate.yml` ships with `on: [pull_request, push]` **and** a `gate-not-configured` `exit 1` guard. So until someone wires it, every push/PR shows a red check — pure noise on a solo / early / local-first project, and it trains people to ignore CI. | This request | Default the shipped workflow to **`workflow_dispatch`** (manual) — or ship the triggers commented out — with a one-step "enable CI" note. Keep the `exit 1` guard so it can't false-green once enabled. (Applied here: switched to `workflow_dispatch`-only.) |
| K2 | High | **Documented gate ≠ runnable gate.** `ENGINEERING_STANDARDS` §2 (DoD) and `gate.yml` both list **lint** and **e2e (incl. a11y)**, but the scaffold shipped **no** ESLint config and **no** e2e harness. Result: items the DoD claims are silently deferred for many slices (lint until EH4; e2e until EH5) — a "false-certainty" cousin where the gate doc overstates enforced rigor. | EH4, EH5 | Ship a **working minimal ESLint flat config** wired to `npm run lint`, and a **minimal e2e harness** (one real browser→API smoke), from commit zero — so "the gate" is real on day one and the DoD isn't aspirational. |
| K3 | High | **Testing strategy misses the real browser→API path.** The kit's three layers (domain unit · API integration via inject · component/jsdom with a fake API) never exercise a real browser hitting the real API. A CORS misconfig shipped and was only caught by manually running the app. | CORS bug → EH5 | `TESTING_STRATEGY` should require a **minimal real-browser smoke** (e.g. Playwright: app loads + one journey against the running API) in the **foundation**, not deferred to hardening. The kit even names this risk (front-load risk) but the test layers didn't cover it. |
| K4 | Med | **No "single source of truth" guard for the pure core in the UI.** The scaffold let the web reimplement domain money/format/date logic (a duplicated penny-exact regex) because the domain package wasn't wired to be consumed by the web. | EH1 | Wire the pure-core package into **both** api and web in the example (workspace dep + bundler-consumable exports), and add an explicit boundary rule: **"presentation imports the domain; never reimplement domain logic in the UI."** Distinguish domain (plain-decimal) from presentation (locale/currency) formatting in the example. |
| K5 | Med | **Service-layer plumbing duplicates by default.** Example services each re-derived date converters and a "group children by parent id" loop, and coupled a constant (`DEFAULT_HOUSEHOLD_ID`) to the **migration module**. | EH2 | Ship a tiny `util/` (dates, `groupBy`) and a neutral `constants.ts` convention in the scaffold, plus a note: **don't couple app constants to the migration module.** |
| K6 | Med | **API example lacks two correctness defaults.** A DB unique-constraint violation surfaced as a **500** (the real guard's failure unhandled), and routes used `req.params as {…}` casts (a typed-assertion escape hatch the standards otherwise forbid). | EH3 | The kit's HTTP example should ship **typed route params** (framework generics) and a **DB-error → domain-error shim** (unique-violation → 409) as the default — tie it to the "consistent error envelope" recommended pattern. |
| K7 | Low | **Gate commands live in 3+ places.** README table, `ENGINEERING_STANDARDS`, and every status report restate the gate commands; keeping them in sync is manual (this project drifted — README omitted `lint` until EH4). | EH2–EH4 | Point all references to **one canonical gate-commands list** (e.g. the README table), or generate them, so adding a gate step is a one-place edit. |
| K8 | Low | **Status-report filenames collide within a day.** Multiple reports per day share the date prefix (`2026-06-15-eh{1..4}`). Minor, but the template implies one-per-day. | EH1–EH4 | Document a within-day suffix convention (we used `-<item>`); note it in the status-report template. |
| K9 | Med | **Handoff needed a per-milestone kickoff prompt.** The kit had a *generic* resume prompt (`KICKOFF-PROMPT.md`) but no per-milestone, paste-ready prompt naming the next item, its risks, and any new setup — so a fresh context window had to re-derive the next step. | This request | **Applied here & port to kit:** status reports now end with a "Next-session kickoff prompt" (§7 of the template); `00_WAYS_OF_WORKING.md` §9 + `CLAUDE.md` require, at each milestone, that the project is handoff-ready and the report carries that prompt. The newest report becomes both handoff and launch pad. |

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
