---
id:     DOC-DEPLOY-CONTRACT  # REQUIRED · stable + typed, see 00_WAYS_OF_WORKING.md §4
type:   deploy-contract
status: Draft  # Draft → Accepted
---
<!--
DEPLOY CONTRACT — the interface between this project and whatever runs it.

Copy to `docs/DEPLOY_CONTRACT.md` when the project first gets deployed somewhere real.
This is a CONTRACT, not a runbook: it says what the operator can rely on and what changes
would break them. The stack-agnostic rules behind it are in `docs/DEPLOYMENT.md` — read
that FIRST, because §1 (namespace the API) and §2 (deny-by-default build context) are
nearly free at project start and breaking changes afterwards.

Delete sections that don't apply; keep the headings you do use, so the operator always
finds the same shape across projects.
-->

# Deploy contract — <project> on <host / platform>

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Status       | <Draft / Accepted>                                               |
| Owner        | <name>                                                           |
| Consumed by  | <who deploys this — the other repo/team that reads this file>    |
| Purpose      | What the operator can rely on, and what would break them.        |
| Last updated | <YYYY-MM-DD>                                                     |

> **Audience:** whoever runs this, who may not have the source checked out. Prefer stating
> the guarantee over explaining the implementation.

## 1. Artifact

| | |
| --- | --- |
| Registry / location | <where the artifact is published, and whether pulling it needs credentials> |
| Tags | <the tagging scheme> |
| Platform | <architectures built> |
| Size | <compressed / on disk> |
| Base | <base image or runtime> |
| User | <the non-root user it runs as> |
| Build | <where it is built — and where it is deliberately NOT built> |
| Provenance | <attestation/signature, and how to verify it before deploying> |

**Current release — `<version>`** (<date>):

| | |
| --- | --- |
| Digest | `<sha256:…>` |
| Tags | <tags pointing at that digest> |
| Source | <commit / tag / build run> |
| Carries | <the roadmap items in this release> |

> **Pin by digest, not by tag.** A tag can be repointed and nothing announces it — a deploy
> tracking a tag can change underneath itself. Record the digest here and pin it in the
> stack file.

<!-- If one process serves both the client and the API, say so explicitly, and state the
     API base path (docs/DEPLOYMENT.md §1). Operators need to know there is no separate
     web container or proxy sidecar. -->

## 2. Ports

| Port | Purpose |
| ---- | ------- |
| `<port>` | <what it serves> |

State what is **not** exposed and why — particularly the datastore. A port that isn't
published is a security property worth writing down.

## 3. Environment

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `<VAR>` | <yes/no> | <default> | <what it does; what happens if unset> |

Secrets come from the operator's own mechanism and are **never** committed
([`../docs/SECURITY.md`](../docs/SECURITY.md) §1). Say which variables are secrets.

## 4. Dependencies & state

- **What must exist before this starts** (datastore, network, volumes).
- **What holds state**, and what is safe to destroy.
- **What the app creates on first start** vs. what the operator must provision.

## 5. Transport & session security

Decide before going live, not after: TLS termination, cookie flags (`Secure`, `SameSite`),
and anything that behaves differently over plain HTTP on a LAN than it does over TLS. This
section exists because these defaults are silently wrong far more often than they are
loudly wrong.

## 6. Health

| Endpoint | Meaning |
| -------- | ------- |
| `<path>` | <what a pass actually proves — and what it does not> |

A health check that only proves the process is listening should say so.

## 7. First run & operations

Numbered, copy-pasteable steps for: first start, upgrade, rollback, backup, restore.

**Answer the identity question explicitly** ([`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) §3):

- [ ] Does a backup/export carry **identity** (users, sessions, credentials), or only domain data?
- [ ] After a restore, seed, or reset — **can a human still sign in?** State how.
- [ ] How does the **first** user come to exist on a brand-new install, through the UI?

## 8. Data at rest

Encryption, disk location, who can read the volume, and any open questions — marked as open
rather than quietly omitted.

## 9. Change policy

What the operator can rely on not changing without notice (ports, env var names, the health
path, the API base path), and how a breaking change gets communicated.

## 10. The demo instance

<!-- If the project has a hand-it-to-someone demo box. The pattern and its rationale are in
     `docs/DEPLOYMENT.md` §4 — this section records the CONCRETE choices. -->

| | |
| --- | --- |
| Image | <the SAME image and tag as production> |
| Stack name | <pinned IN the stack file, not derived from the directory> |
| Volume / network | <its own, under distinct names> |
| Datastore URL | <hard-wired to the demo's own service — never interpolated from the environment> |
| Credential | <the published, documented demo login> |
| Refresh | <the single command that re-pristines data AND credential between showings> |

**What it does not share with the real deployment:** <list — volume, network, signing
secret, project name>.

**Seeding needs a checkout**, because the production image deliberately excludes the seeder
— demo data is *absent* from the real artifact, not flag-guarded. State the command.

**What pins all of the above:** <the validation harness — and note that the isolation
guarantees are asserted statically from the rendered stack config, before anything starts
(`docs/DEPLOYMENT.md` §5)>.
