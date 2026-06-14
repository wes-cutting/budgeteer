# Architecture Decision Records

The index of decisions for this project. One decision per ADR; **append-only** (to change
a decision, write a new ADR that supersedes the old one — never edit history); status per
[`../00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4. New ADRs start from
[`ADR-TEMPLATE.md`](ADR-TEMPLATE.md).

| ADR | Title | Status |
| --- | ----- | ------ |
| [ADR-0000](ADR-0000-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [ADR-0001](ADR-0001-stack.md) | Stack (TypeScript · React+Vite · Fastify) | Accepted (validated by SPIKE-02) |
| [ADR-0002](ADR-0002-datastore.md) | Datastore + access layer (PostgreSQL · Kysely) | Validated (prod path confirmed at deploy) |
| [ADR-0003](ADR-0003-money-integer-minor-units.md) | Money is integer minor units | Accepted |
| [ADR-0004](ADR-0004-transfer-modeling.md) | Transfer modeling (account legs + envelope-transfer rows) | Accepted (validated by SPIKE-04) |

> Add a row per ADR as it's written, newest decisions kept discoverable. When a decision
> is replaced, mark the old ADR `Superseded by ADR-XXXX` and add the new one — don't delete
> the row. `ADR-0001`/`ADR-0002` are the conventional slots for the stack and datastore
> (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §3); further ADRs cover any other
> expensive-to-reverse choice (auth/tenancy model, money/units, API style, …).
