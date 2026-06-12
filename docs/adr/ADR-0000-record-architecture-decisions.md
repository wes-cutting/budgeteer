# ADR-0000: Record architecture decisions

| Field    | Value        |
| -------- | ------------ |
| Status   | Accepted     |
| Date     | <YYYY-MM-DD> |
| Deciders | DrewskiLabs  |

## Context

Decisions that are expensive to reverse — stack, datastore, auth model, data
representation, API style — need to be captured with their rationale so future work (and
future context windows) understands *why*, not just *what*.

## Decision

We record each significant decision as an **Architecture Decision Record (ADR)** in
`docs/adr/`, numbered sequentially (`ADR-0001`, `ADR-0002`, …), using
[`ADR-TEMPLATE.md`](ADR-TEMPLATE.md).

Rules:
- **One decision per ADR.**
- ADRs are **append-only**: to change a decision, write a new ADR that **supersedes** the
  old one; mark the old one `Superseded by ADR-XXXX`. Don't rewrite history.
- Each ADR carries a `Status` from the ladder in
  [`../00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4. **A decision that rests on an
  unobserved assumption stays `Proposed` until a spike validates it**, then becomes
  `Accepted`. Do not `Accept` on paper.
- The **stack is decided per project** here, not in the baseline:
  - `ADR-0001` — language / framework / runtime.
  - `ADR-0002` — datastore + access layer.
  - Further ADRs for any other expensive-to-reverse choice (auth/tenancy model, money/units
    representation, API style, …).

## Consequences

- The rationale behind structural choices is durable and reviewable.
- Reversing a choice is explicit and traceable, not silent drift.
- New contributors/agents can reconstruct the "why" quickly.
