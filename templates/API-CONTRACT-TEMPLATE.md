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

- Versioning strategy.
- Naming, request/response formats, pagination, idempotency.
- Authn/authz expectations for callers (default-deny; tenant scoping).

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
