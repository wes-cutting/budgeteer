<!--
DOMAIN MODEL TEMPLATE — copy to docs/04_DOMAIN_MODEL.md. The conceptual model: entities,
relationships, invariants, lifecycles. Stack/storage-neutral (the data model doc maps
this to a physical schema).
-->

# Domain Model — <Project>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Draft · Proposed · Validated · Accepted |
| Owner        | <name>                                 |
| Last updated | <YYYY-MM-DD>                           |

## 1. Glossary

Define the ubiquitous language — the terms used in code, docs, and with users.

| Term | Meaning |
| ---- | ------- |
| …    | …       |

## 2. Entities

For each entity: its purpose, key attributes, and the invariants that must always hold.

### <Entity>
- **Purpose:** …
- **Key attributes:** …
- **Invariants:** … (these become property tests)

## 3. Relationships

How entities relate (one-to-many, ownership, references). A simple diagram or list.

## 4. Lifecycles / state

For entities with meaningful states, the allowed states and transitions.

```
<state A> → <state B> → <state C>
```

## 5. Derived vs. stored

Call out which values are **derived** (computed from an immutable log/other data) vs.
**stored**. Prefer deriving computed state (see ENGINEERING_STANDARDS recommended
patterns).

## 6. Cross-cutting rules

Tenancy/ownership scoping, units/money representation, and other rules that span entities.
