# Engineering Standards

| Field   | Value                                                  |
| ------- | ----------------------------------------------------- |
| Status  | Accepted                                              |
| Owner   | DrewskiLabs                                           |
| Purpose | The conventions, the Definition of Done, and opt-in recommended patterns. |

Stack-agnostic. Where a rule needs a concrete tool (formatter, linter, type checker),
the project names it in its own `ADR-0001` and lists the exact commands in its top-level
README; the *intent* below is constant.

---

## 1. Conventions

- **Clarity over cleverness.** Code is read far more than written.
- **Strong typing where the language allows it.** Avoid escape hatches (`any` and
  equivalents); prefer precise types or validated unknowns narrowed at the boundary.
- **Validate all external input at the boundary** (requests, files, env, third-party
  responses) with an explicit schema; invalid input fails loudly with a clear error.
- **Errors are explicit and typed.** Surface a consistent error shape at interfaces;
  never swallow errors silently.
- **Small, pure functions for logic; side effects at the edges** (see
  [`ARCHITECTURE.md`](ARCHITECTURE.md)).
- **Names say what, not how.** Consistent casing and file layout per the project's stack.
- **No dead code, no commented-out blocks** left behind; delete via version control.

## 2. Definition of Done

A change is done when **all** of the following hold (this extends the per-slice DoD in
[`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) §5). This checklist is mirrored as a PR
template at [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) so it
is checked on every change:

- [ ] Acceptance criteria met and covered by tests.
- [ ] The capability is **usable end-to-end** (data → API → UI), not just a layer.
- [ ] Gate green: types/typecheck, lint, format, unit + integration tests, end-to-end for
      the journey, build. **No failing or skipped tests.**
- [ ] External input validated at the boundary.
- [ ] UX states handled: empty, loading, error, success (and permission-limited if
      relevant).
- [ ] Accessibility check on changed UI (baseline **WCAG 2.2 AA**; respect
      `prefers-reduced-motion`).
- [ ] Authorization checked at the resource level (default-deny) where applicable.
- [ ] No secrets committed or logged.
- [ ] Relevant docs updated **in the same change**; doc status promoted as warranted.

## 3. Commits & workflow

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, …
- **Trunk-based** with short-lived branches off the default branch; commit/push only when
  the human asks. If on the default branch, branch first.
- Keep changes small and reviewable; a commit should leave the gate green.

## 4. Recommended patterns (opt-in, not mandates)

These earned their place on past projects. **Adopt them when the project's domain calls
for it** — they are guidance, not requirements, and several are stack-flavored. Record
the choice in an ADR when adopted.

- **Money / exact quantities as integer minor units.** Represent currency (and other
  must-be-exact quantities) as integers in the smallest unit, with a *single* conversion
  boundary for parsing/formatting. No floating-point arithmetic on money. Prevents an
  entire class of rounding bugs.
- **Derive, don't store, computed state.** Where a value is a function of an immutable
  log (a balance from transactions, a status from events), **derive it on read** rather
  than storing and mutating it. The log is the source of truth; the derived value can't
  drift. (Trade-off: add read-model caching only when measured performance requires it.)
- **Tenant / owner scoping by default.** In any multi-user or multi-tenant system, scope
  *every* data-access query by the caller's tenant/owner, check authorization at the
  resource level (default-deny), and return "not found" rather than "forbidden" for
  cross-tenant access so existence doesn't leak.
- **Pure core / impure shell.** Keep decision logic pure and push I/O to adapters, so the
  logic is exhaustively testable without infrastructure.
- **Idempotent, reconcilable data imports.** One-time/seed imports run through the same
  validation as the app, are idempotent against an empty/known dataset, and **reconcile
  to a checkable invariant** (a pass/fail gate) so "did it work?" is never a guess.
- **A consistent error envelope** at every interface (a stable shape with a code,
  message, and correlation id) so callers and logs can rely on it.

## 5. Performance, observability, hardening

Treat these as first-class but **measure before optimizing**:

- Set performance budgets, but assert them against **realistic data volumes** (not an
  empty dev database).
- Add structured logging with a correlation id from the start; add metrics/tracing as the
  system grows.
- Wire a dependency/vulnerability scan (SCA) into CI early — it's cheap and easy to forget.

Record the project's concrete targets — budgets, SLOs, observability plan, and the
operational-readiness checklist — in its `07_NFR.md`, from
[`../templates/NFR-TEMPLATE.md`](../templates/NFR-TEMPLATE.md). These are written and
validated during the hardening phase ([`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) §7).
