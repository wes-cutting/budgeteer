<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Stay Proposed until a spike validates the assumptions.
-->

# ADR-0006: Client routing — React Router (data router)

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Accepted                                                          |
| Date          | 2026-06-25 (Accepted 2026-06-27)                                  |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | [`SPIKE-06`](../spikes/06-design-system-routing.md) (Account Register deep-link / back-forward / refresh + axe-clean; bundle measured) |
| Realized by   | `UX3` ([status](../status-reports/2026-06-27-ux3.md)) — the whole app now runs on the data router behind a persistent shell; the SPIKE-06 throwaway harness was discarded (findings persist here + in the spike report) |

## Context

The web app navigates via a hand-rolled `view` state machine in
[`apps/web/src/App.tsx`](../../apps/web/src/App.tsx): no URLs, no browser back/forward, a refresh
drops to the dashboard, and every screen carries a manual "← Dashboard" button. The
[UX Uplift](../reviews/2026-06-25-ux-uplift-initiative.md) needs a **persistent app shell** with
URL-addressable, refresh-safe, deep-linkable, nested-layout routing.
[`SPIKE-06`](../spikes/06-design-system-routing.md) baked React Router against TanStack Router on a
real Account Register.

## Decision

We will use **React Router 7 (data router)** with a **persistent root layout** (the app shell) and
**nested routes**, retiring the `view` state machine. The route map is per the
[UX uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`/`, `/accounts/:id`,
`/envelopes/:id`, `/insights/:view`, `/manage`, …). `UX3` realizes the shell.

## Consequences

### Positive
- **Conventional and ubiquitous** — large ecosystem, low boilerplate, well-understood nested
  layouts and data APIs.
- **Real history semantics, proven** — on the probe screen, deep-link to `/accounts/:id`, browser
  back/forward, and refresh all work; the screen is axe-clean (0 violations).
- **Bundle is competitive** — 39.6 KB gz, within ~3.5 KB of TanStack.

### Negative / cost
- **Params are untyped** (`useParams()` returns `string | undefined`) — weaker than TanStack's
  typed routes/params/search.
- Adds a routing dependency (~39.6 KB gz).

### Neutral
- Replaceable behind the shell; TanStack Router is a near-drop-in alternative if typed routing
  later becomes a priority.

## Alternatives considered

### TanStack Router
Stronger type-safety (typed routes/params/search) and **slightly smaller** (36.1 KB gz). Rejected
as default for more boilerplate (`createRootRoute`/`createRoute`/`getParentRoute`) and less
ubiquity. **Noted as the alternative** if typed routing becomes a priority.

### Hash routing / hand-rolled
Lowest dependency, but loses real history semantics and clean deep links — the very things this
decision exists to provide.

## Supersedes / superseded by

- Supersedes: — (replaces the informal `App.tsx` `view` state machine)
- Superseded by: —
