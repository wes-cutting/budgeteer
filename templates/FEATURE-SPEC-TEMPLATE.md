<!--
FEATURE SPEC TEMPLATE — copy to docs/features/<slug>.md. Pair with a UX spec
(templates/UX-SPEC-TEMPLATE.md) for any user-facing feature. Status uses the ladder in
docs/00_WAYS_OF_WORKING.md §4. Build as a vertical slice (data → API → UI).
-->

# Feature Spec — <Feature>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-XXX                               |
| Status       | Draft · Proposed · Validated · Accepted · Implemented |
| Owner        | <name>                                 |
| Last updated | <YYYY-MM-DD>                           |
| Related      | <PRD goal / journey · UX spec · ADRs>  |

## 1. Summary

What this feature is, in a few sentences.

## 2. Scope

- **In scope** — …
- **Out of scope** — …

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As a <role>, I want <…> so that <…>. | Must |

## 4. Acceptance criteria

Concrete, testable. Each maps to at least one test.
- **Given** <state>, **when** <action>, **then** <result>.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| …        | …                 |

## 6. Data changes

Entities/fields added or changed (update the domain & data model docs in the same change).

## 7. Interface changes

API/operations added or changed (update the API contract). Note the **UI** surface and
link the UX spec.

## 8. Dependencies

Other features/spikes/ADRs this relies on.

## 9. Security, privacy & accessibility

Authz, confidential data handling, and accessibility notes specific to this feature.

## 10. Test plan

Unit / property / integration / e2e for this feature; how acceptance criteria are covered.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| …        | …     | open   |
