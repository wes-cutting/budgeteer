<!--
PULL REQUEST TEMPLATE — carry as-is. This checklist mirrors the Definition of Done in
docs/ENGINEERING_STANDARDS.md §2 and the per-slice DoD in docs/00_WAYS_OF_WORKING.md §5.
A box you can't check is a blocker, not a footnote — say why under "Carries / follow-ups".
-->

## What & why

<!-- One or two sentences: the capability this change delivers and the problem it solves. -->

## Linked docs

<!-- The slice this implements and the docs it satisfies / updates. -->
- **Roadmap item:** <`03_ROADMAP.md` # / phase>
- **Spec(s):** <feature spec · UX spec · PRD goal/journey>
- **ADR(s):** <ADR-XXXX, if a decision was made or changed>
- **Spike(s):** <report(s) that de-risked this, if any>

## Type of change

- [ ] **Feature slice** — vertical (data → API → UI), usable end-to-end
- [ ] **Spike** — throwaway investigation; findings recorded in a spike report
- [ ] **Refactor / chore / docs** — no behavior change

## Definition of Done

> A failing **or skipped** test blocks completion. CI runs the **same** gate as local.

**Usable & correct**
- [ ] Acceptance criteria met and covered by tests.
- [ ] Capability is **usable end-to-end** (data → API → UI), not just a layer.
- [ ] UX states handled: empty · loading · error · success (· permission-limited if relevant).

**The gate is green** (see [`docs/TESTING_STRATEGY.md`](../docs/TESTING_STRATEGY.md) §3)
- [ ] types / typecheck
- [ ] lint
- [ ] format check
- [ ] unit + integration
- [ ] e2e for the journey (incl. accessibility scan)
- [ ] build

**Boundaries & security**
- [ ] External input validated at the boundary; invalid input fails loudly.
- [ ] Authorization checked at the **resource level** (default-deny) where applicable.
- [ ] No secrets or confidential data committed or logged; tests use **synthetic fixtures**.

**Accessibility**
- [ ] Changed UI meets **WCAG 2.2 AA**; respects `prefers-reduced-motion`.

**Docs in the same change**
- [ ] Data-shape / interface / architecture changes updated the matching doc (domain / data / API).
- [ ] Doc status promoted as warranted ([`00_WAYS_OF_WORKING.md`](../docs/00_WAYS_OF_WORKING.md) §4).

## Carries / follow-ups

<!-- Anything deliberately deferred; any box left unchecked (and why); surprises that should
become spikes. "Decided ≠ validated" — be honest here, don't paper over gaps. -->

---
Commits follow **Conventional Commits** (`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:`).
Full checklist source: [`docs/ENGINEERING_STANDARDS.md`](../docs/ENGINEERING_STANDARDS.md) §2.
