---
type: feature-spec
roadmap-item: BUD-S48
status: Implemented
---
<!--
FEATURE SPEC — scopes roadmap item UX4 (2026-06-25 UX Uplift). Build as a vertical slice:
tokens + a starter primitive set, PROVEN by restyling one real screen (the Account Register)
in place. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Design system foundation (tokens + starter primitives)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX4                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-26-ux4.md))    |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-06-25                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX4`) · [`ADR-0005`](../adr/ADR-0005-frontend-design-system.md) · [`SPIKE-06`](../spikes/06-design-system-routing.md) · proof screen: [`AccountRegister.tsx`](../../apps/web/src/AccountRegister.tsx) |

## 1. Summary

The styled vocabulary the rest of the UX Uplift reuses. Per [`ADR-0005`](../adr/ADR-0005-frontend-design-system.md),
it is a **token sheet** (CSS custom properties) + **component-scoped CSS Modules** + **Radix
Primitives** for the hard a11y widgets. Critically, this is **not** a component library built in a
vacuum: per the project's *vertical, not horizontal* rule (and the owner's scoping decision on
2026-06-25), UX4 builds **only the tokens + the starter primitives the first real screen needs**,
and **proves them by restyling the Account Register in place** — gate-green and axe-clean in light
**and** dark. Further primitives are added by the later slices that first need them
("**seed + grow per slice**"); this spec is the living registry of what exists.

## 2. Scope

- **In scope**
  - **Token sheet** — color, space, type scale, radius, elevation as CSS custom properties; **dark
    mode** via one `prefers-color-scheme` query; `prefers-reduced-motion` honored globally. Absorbs
    the WCAG 2.5.8 touch-target floor currently in [`index.css`](../../apps/web/src/index.css).
  - **Starter primitives** (the minimum the Account Register exercises) — see §3a inventory.
    **Built:** `Button`, `Field`/`Input`/`Select`, `Badge`, `Card`, `Alert`, `EmptyState`,
    `Skeleton`. **Grown since (per slice):** `Dialog` (Radix) — added by `UX7`, the first genuine
    modal ([FEAT-UX7](quick-add-transaction.md)). **Still deferred:** `Table` (no genuine table yet).
  - **Proof:** restyle the **Account Register in place** onto tokens + primitives, with the
    **current** `view`-machine navigation unchanged.
  - **Conventions:** primitive location (`apps/web/src/ui/`), CSS-Module + token usage rules, and
    the documented "grow per slice" governance (this spec is the registry).
- **Out of scope**
  - **Routing / app shell** — `UX3` (this slice keeps the existing nav).
  - **Primitives the Register doesn't need yet** — `Menu`, `Toast`, `Tabs`, `ProgressBar` — added
    by the slice that first needs them.
  - The cockpit (`UX5`), Insights (`UX8`+), and any other screen migration.
  - **No data / API / domain change** — pure presentation.

### 3a. Starter primitive inventory (each justified by the Account Register)

| Primitive | Register usage | A11y contract |
| --------- | -------------- | ------------- |
| `Button` | Edit split · Delete · Save · Cancel | real `<button>`; ≥24px target; visible focus; variants (default/accent/danger) differ by more than color |
| `Field` + `Input` | From/To date, Search | `<label htmlFor>` tied to control; error text via `aria-describedby` |
| `Select` | envelope picker (in dialog) | native `<select>` with a `<label>` |
| `Table` | transactions list | **deferred** — the register's list stayed a styled `<ul>`/`<li>` (the unit test relies on `closest("li")`); a real `Table` lands with the cockpit/Insights |
| `Badge` | "fully allocated" / "needs $X" | **text + shape**, never color alone; sufficient contrast (incl. dark) |
| `Dialog` (Radix) | allocation editor | **built (UX7)** — `@radix-ui/react-dialog` per ADR-0005; the first genuine modal is the global quick-add (`/transactions/new`). Radix supplies the focus trap / ESC / overlay-close / focus-restore / `role="dialog"` + `aria-labelledby`; axe-clean light **and** dark ([FEAT-UX7](quick-add-transaction.md)). +~12 KB gz (105.4 KB total < 120 KB budget) |
| `Alert` | load/save error | `role="alert"`; text, not color alone |
| `EmptyState` | "No transactions yet…" | heading + a clear next action |
| `Skeleton` | loading | `aria-hidden` placeholder with an accessible "Loading…" status |

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As a user, the Account Register looks like a designed app — clear hierarchy, legible money, an accessible split dialog — and works in dark mode. | Must |
| US-2 | As a keyboard/screen-reader user, the restyled Register stays fully operable; the split dialog traps focus and restores it on close. | Must |
| US-3 | As a developer, I have a token sheet + a starter primitive set and a documented "grow per slice" rule, so later screens reuse instead of reinvent. | Must |

## 4. Acceptance criteria

- **Given** the app, **then** a token sheet defines color/space/type/radius/elevation and **dark
  mode** falls out of `prefers-color-scheme`; `prefers-reduced-motion` is honored.
- **Given** the Account Register, **when** rendered, **then** it uses the starter primitives with
  **no ad-hoc inline styles**, and its behavior/flow is unchanged (same nav, same actions).
- **Given** the axe scan (WCAG 2.2 AA), **when** run on the restyled Register in **light and dark**,
  **then** 0 violations.
- **Given** allocation status, **then** it is conveyed by **text + shape**, not color alone
  (e.g. a "needs $X" badge reads its text).
- *(Validated by `UX7`)* a modal's focus trap / `Esc` / focus-restore — the `Dialog` primitive
  (Radix) landed at its first genuine modal (the global quick-add) and is axe-clean light **and** dark.
- **Given** the gate, **then** typecheck · lint · format · unit · e2e (incl. a11y) · build all pass;
  the existing Account Register e2e pass against the restyled DOM.
- **No** data/API/domain change.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Long account / payee names | wrap or truncate without breaking layout; full text available |
| Zero transactions | `EmptyState` with a clear next action (not a bare line) |
| Over-budget / negative amount | sign **and** color **and** a textual cue (not color alone) |
| Dark mode | every token pair meets ≥ AA contrast; dialog/overlay readable |
| Small viewport (desktop-first) | dialog + table remain usable; not a mobile-first redesign |
| Load / save error | `Alert` (`role="alert"`) with message + recovery, as today |

## 6. Data changes

None — pure presentation. No domain/data-model doc changes.

## 7. Interface changes

- **No API change.** New `apps/web/src/ui/` (token sheet + primitives); `AccountRegister.tsx`
  recomposed onto them. Adds the `@radix-ui/react-*` dependency to `apps/web` (per `ADR-0005`).
- **No separate UX spec** is created: UX4 changes presentation, not flow — the Register's user
  journey is unchanged. The visual states are specified here (§4/§5) and verified by the existing
  Register e2e + the axe scan. (Recorded as a conscious choice, not an omission.)

## 8. Dependencies

- **`UX1` (done)** — [`ADR-0005`](../adr/ADR-0005-frontend-design-system.md) +
  [`ADR-0006`](../adr/ADR-0006-client-routing.md) `Validated`; the
  [`SPIKE-06`](../spikes/06-design-system-routing.md) token sheet + Radix dialog patterns are the
  reference to port.
- **Not** dependent on `UX3` (routing) — in-place restyle keeps the current nav. `UX3` follows.

## 9. Security, privacy & accessibility

- No new data exposure; no new logging (so no financial-data-in-logs risk).
- **Accessibility is the headline acceptance bar:** axe-green (WCAG 2.2 AA) in light **and** dark;
  keyboard-operable; visible focus; screen-reader-correct dialog; `prefers-reduced-motion` honored;
  **color is never the sole signal**.

## 10. Test plan

- **Unit / interaction (Vitest + Testing Library):** each starter primitive — render, variants,
  a11y attributes; `Dialog` focus-trap / `Esc` / focus-restore; `Field` label association.
- **e2e (Playwright):** the existing `e2e/*account*`/register specs pass against the restyled DOM
  (re-pointed only if selectors change); extend `e2e/a11y.spec.ts` with a **dark color-scheme**
  axe pass on the Register.
- **Gate:** full gate green; no skipped/failing tests.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Primitive location — `apps/web/src/ui/`? | Wesley + agent | **resolved: yes** (`apps/web/src/ui/`) |
| Token naming — semantic vs scale? | agent | **resolved: semantic** (`--color-accent`, `--space-3`, …) |
| Add a dark-mode axe pass to `e2e/a11y.spec.ts`? | agent | **resolved: yes** (+2 dark scans) |
| Delete `index.css` once the token base absorbs the touch-target floor? | agent | **resolved: yes** (deleted; floor in `base.css`) |

> **Status: `Implemented`** (gate-green 2026-06-25 — 283 Vitest + 49 e2e; axe light+dark). Built
> the token sheet + base layer + the seed primitive set and restyled the Account Register in place;
> `Dialog`/`Table` deferred per seed-and-grow. See the
> [status report](../status-reports/2026-06-26-ux4.md).
