<!--
STATUS REPORT — the 2026-07-06/07 UX-Redesign scoping session (docs-only; no code executed).
Right-sized per 00 §9/§11: a scoping block, not a build slice — the DoD table reflects that
honestly. The newest report = the live handoff (CLAUDE.md).
-->

# Status Report — 2026-07-07 (UX-Redesign scoping)

| Field  | Value                                                            |
| ------ | ---------------------------------------------------------------- |
| Status | Snapshot                                                          |
| Date   | 2026-07-07                                                        |
| Author | Claude (design session with the owner)                            |
| Scope  | The UX Redesign initiative, scoped end-to-end — docs only, zero code; delta since [2026-07-03-s7-slice.md](2026-07-03-s7-slice.md) |

**Resume here:** The **UX Redesign (`UXR1`–`UXR8`) is fully scoped and documented** — brief,
roadmap track, and a `Proposed` feature/UX spec or FEAT note per item; **every design question
is owner-resolved** (nav groups · Add-transaction placement · `<h1>` ownership · icons · slice
size · Reserve semantics · API sourcing · countdown scopes · Insights IA · the three ratified
judgment calls). The **bundle budget is re-baselined 120 → 140 KB gz** (`07_NFR` §1³). No code
changed; the gate was last green at S7/K24 (415 Vitest + 99 e2e). Next: flip the first items
to `Ready` (owner nod) and build — recommended **UXR8 (demo seed, no gate) → UXR1 (sidebar
shell)**, per the brief §5 order.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Initiative brief | `UXR1`–`UXR8` captured + closed; principles, tensions, build order | [reviews/2026-07-06-ux-redesign-initiative.md](../reviews/2026-07-06-ux-redesign-initiative.md) |
| UXR1 sidebar shell | [UX spec](../ux/app-shell-sidebar.md) + [FEAT-UXR1](../features/app-shell-sidebar.md), all §11 Qs resolved | roadmap `UXR1` |
| UXR2 pay-period planner | [UX spec](../ux/pay-periods-planner.md) + [FEAT-UXR2](../features/pay-periods-planner.md); additive API fields specced | roadmap `UXR2` |
| UXR3–UXR6 UX specs | [Ledgers tables](../ux/ledgers-tables.md) · [Templates + form pattern](../ux/templates-page.md) · [Recurring](../ux/recurring-page.md) · [Insights IA](../ux/insights-ia.md) | roadmap `UXR3`–`UXR6` |
| UXR7/UXR8 FEAT notes | [Manage form](../features/manage-move-money.md) · [demo seed](../features/demo-seed.md) | roadmap `UXR7`/`UXR8` |
| Bundle budget re-baseline | 120 → **140 KB gz**, rationale + carried rules in the NFR; measured 118.67 (fresh `vite build`) | [`07_NFR` §1³](../07_NFR.md) |
| Guardrails & cleanup | `docs/ux/assets/` + README; the sheet screenshot **gitignored by name** (real creditors — rule verified); empty `examples/dashboard-rework.ts` removed | `.gitignore` |

## 2. Definition of Done — current state (a scoping block, not a build slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ⚠ n/a | Nothing built — this block *produced* the acceptance criteria (each spec §"Acceptance") |
| Gate green | ⚠ not re-run | Zero code changed; last green at S7/K24 (415 Vitest + 99 e2e). One `vite build` run to measure the bundle (118.67 KB gz) |
| Usable end-to-end | ✅ unchanged | The app is untouched; S7 state stands |
| Docs updated in same change | ✅ | This change **is** the docs: brief · 8 specs/notes · roadmap track + 7 log rows · NFR · prettier-clean throughout |
| Security | ✅ | Real-data screenshot gitignored by name (`git check-ignore` verified); UXR8 spec bans real creditor names from seed code |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 415 | 415 | 0 (no code) |
| E2E | 99 | 99 | 0 (no code) |

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Drop the two reference screenshots into `docs/ux/assets/` | They exist only in the chat session; filenames + rules in the [assets README](../ux/assets/README.md) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Untouched by UXR2 (owner confirmed the redesign is presentation, not policy) | Owner — still the roadmap's open decision |
| Per-item `Ready` nods | Specs are `Proposed`; the ladder needs the owner's nod before build | Owner, at kickoff |

## 5. Outstanding & next steps

- Commit this session (suggested: `docs: scope the UX Redesign (UXR1–UXR8); re-baseline bundle budget to 140 KB`).
- Build order (brief §5): **UXR8 → UXR1 → UXR2 → UXR3 ∥ UXR4 → UXR5/UXR7 ∥ UXR6.**

## 6. Commands & gotchas (cold-start)

```sh
npm install && npm run gate     # full gate: types · lint · format · unit · e2e · build · SCA
npm run db:reset && npm run seed  # clean dev baseline (4 accounts · 22 envelopes · 8 targets)
```

- The **140 KB gz** budget is the re-baselined number — log each slice's delta in `07_NFR` §1³.
- UXR8 must be **additive** (`seed:demo`); the baseline `seed` is depended on by e2e/K24.
- UXR1 touches every view's `<h1>` — expect broad-but-shallow test churn; it's specced (FEAT-UXR1 §3).

## 7. Next-session kickoff prompt

> Read `docs/status-reports/2026-07-07-uxr-scoping.md` (the handoff), then the initiative
> brief `docs/reviews/2026-07-06-ux-redesign-initiative.md`. The UX Redesign (`UXR1`–`UXR8`)
> is fully scoped: every item has a `Proposed` spec and every design question is
> owner-resolved. I'm nodding **UXR8** (`docs/features/demo-seed.md`) and **UXR1**
> (`docs/features/app-shell-sidebar.md` + `docs/ux/app-shell-sidebar.md`) to `Ready`.
> Verify the gate is green, then build **UXR8 first** (additive `seed:demo`, baseline seed
> untouched, strictly synthetic), then **UXR1** (the sidebar shell, one whole slice) —
> vertical, gate-green, docs and roadmap updated in the same change, closing each with a
> status report per the template.
