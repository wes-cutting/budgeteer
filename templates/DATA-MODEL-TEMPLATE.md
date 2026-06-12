<!--
DATA MODEL TEMPLATE — copy to docs/05_DATA_MODEL.md. The PHYSICAL model that realizes the
domain model in the chosen datastore (SQL tables, document collections, etc. — per
ADR-0002). Keep this in sync with migrations in the same change.
-->

# Data Model — <Project>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Draft · Proposed · Validated · Accepted |
| Owner        | <name>                                 |
| Datastore    | <per ADR-0002>                         |
| Last updated | <YYYY-MM-DD>                           |

## 1. Overview

How the domain entities map to physical storage; any notable denormalization or
read-models (and why).

## 2. Tables / collections

For each:

### <name>
- **Purpose:** maps to <domain entity>.
- **Fields:** name · type · nullable · notes (units, representation — e.g. integer minor
  units for money).
- **Keys:** primary key; natural/unique keys.
- **Indexes:** which queries they serve (include tenant/owner-scoped indexes).
- **Constraints:** foreign keys + on-delete behavior; checks; uniqueness.

| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| …     | …    | …    | …     |

## 3. Relationships & integrity

Referential rules across tables/collections (cascade vs. restrict vs. set-null) and why.

## 4. Migrations

Migration approach for the chosen datastore; rule: **schema changes ship with the doc and
code in the same change.**

## 5. Seed / fixtures

How synthetic seed/fixtures are produced (in code, reviewable). Real/confidential data is
never committed.
