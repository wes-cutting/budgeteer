---
id:     DOC-API-CONTRACT  # REQUIRED · stable + typed, see 00_WAYS_OF_WORKING.md §4
type:   standard
status: Draft  # Draft → Proposed → Validated → Accepted
---
<!--
API CONTRACT TEMPLATE — copy to docs/06_API_CONTRACT.md. The contract other code depends
on. Applies to whatever interface style the project picks (HTTP/REST, RPC, GraphQL, or an
internal module contract). Keep it in sync with the implementation in the same change.
-->

# API Contract — <Project>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Draft · Proposed · Validated · Accepted |
| Owner        | <name>                                 |
| Style        | <REST / RPC / GraphQL / internal>      |
| Last updated | <YYYY-MM-DD>                           |

## 1. Conventions

- **Base path:** `<e.g. /api>` — **decide this before publishing anything.** If one process
  will ever serve both a UI and this API from the same origin, the API must be namespaced from
  day one. Client routes and endpoints get named after the same domain nouns, so they collide
  *because* both were named well — here **seven of fifteen** client routes were spelled exactly
  like API endpoints, and a refresh on the Accounts page returned JSON. Identical paths cannot
  be fixed by ordering, only by renaming one side after every caller depends on it: nearly free
  now, breaking later ([`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) §1; `K34`).
- Versioning strategy.
- Naming, request/response formats, pagination, idempotency.
- Authn/authz expectations for callers (default-deny; tenant scoping).
- **Does any export/backup operation carry identity** (users, sessions, credentials) or only
  domain data? State it here — otherwise every rebuild path inherits the gap independently and
  each failure looks unrelated ([`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) §3; `K39`).

## 2. Error envelope

The single, consistent error shape every operation returns:

```
{ "error": { "code": "<STABLE_CODE>", "message": "<human-readable>", "correlationId": "<id>" } }
```

Standard codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `INTERNAL`, … Never leak internals or secrets in messages.

## 3. Resources / operations

For each operation: purpose, inputs (validated schema), outputs, errors, authz.

### <operation / endpoint>
- **Purpose:** …
- **Input:** … (validated at the boundary)
- **Output:** …
- **Errors:** …
- **Authz:** …

## 4. Internal contracts (non-network)

Document important internal module boundaries the same way (signature, inputs, outputs,
failure modes) — e.g. a one-time importer/seed entry point.

## 5. Change policy

Backward-compatibility rules; how breaking changes are versioned and communicated.
