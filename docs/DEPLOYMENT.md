---
id:     DOC-DEPLOYMENT
type:   standard
status: Accepted
---
# Deployment

| Field   | Value                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Status  | Accepted                                                                 |
| Owner   | DrewskiLabs                                                              |
| Purpose | The constraints that are cheap at project start and breaking changes later. |

The rules that don't change. This project's **concrete** deployment — image, ports,
environment, health, operations, the demo box — is
[`DEPLOY_CONTRACT.md`](DEPLOY_CONTRACT.md), written from
[`../templates/DEPLOY-CONTRACT-TEMPLATE.md`](../templates/DEPLOY-CONTRACT-TEMPLATE.md).

Every rule below was learned here the expensive way (`BUD-S81`–`BUD-S96`) and is folded back
into the baseline kit as `K34`/`K36`/`K39`/`K43`/`K45` — this repo is their reference
implementation.

Every rule below shares a shape: **it costs almost nothing at commit zero and is expensive or
breaking once something has shipped.** That is the whole reason they live in a doc read at the
start rather than in a deployment runbook read at the end.

---

## 1. If one process will ever serve both a UI and its API, namespace the API from day one

Put the API under a base path — `/api/**` — **before any contract is published.**

The one-image, one-origin deployment (a single process serving the built client *and* the API)
is the right default for a small self-hosted app: one container, one port, no reverse-proxy
sidecar. But it silently assumes the client's routes and the API's paths don't collide, and
**that assumption fails precisely because both are named after the same domain nouns.** A
client route `/accounts` and an endpoint `GET /accounts` are what *good* naming produces on
both sides independently. In the reference project, seven of fifteen client routes collided
exactly with API paths — and a browser refresh or a bookmark on one of those pages returned
JSON instead of the app.

Route ordering cannot fix it. The paths are *identical*, so there is nothing to order — the
only fix is to namespace one side. Doing that after a contract is published means changing
every path, every test, and every client call at once.

Record the base path in the project's API contract as a convention, next to versioning
([`../templates/API-CONTRACT-TEMPLATE.md`](../templates/API-CONTRACT-TEMPLATE.md)).

**Alternatives, named so nobody rediscovers them as ideas:** content-negotiating on the
request's destination (`Sec-Fetch-Dest`), or moving the client under its own prefix (`/app`).
Both work. Both are strictly worse than getting the namespace right at the start — the first
makes routing depend on a header the client controls, the second puts the ugly prefix on the
half users actually see.

## 2. The build context is deny-by-default, because it leaves the machine

Write the ignore file for the build context **inverted** from the source-control ignore file:
deny everything, then allow back exactly the build inputs.

```
*

!<manifests / lockfile>
!<service source dirs>
!<shared package source>

# Re-exclude what the allow-rules pull back in — subtree allows re-include everything under them
**/node_modules
**/dist
**/.env
```

The instinct is to mirror `.gitignore`: allow everything, exclude the known-bad. That is a
*convenience filter*, and it is the wrong posture here. An image gets **published**. A repo
accumulates confidential things in ignored paths — real data, `.env` files, backup exports.
A `.gitignore`-shaped build-context ignore protects only what someone remembered to list, so
**any confidential file added later ships silently, with no failure to notice.**

Deny-by-default inverts who bears the cost of forgetting: a new source directory that nobody
allow-listed breaks the build loudly, which is a good failure. Treat it as an authorization
rule, not a filter — and say so in a comment at the top of the file, because the next person
to edit it will otherwise "fix" it back into the convenient shape.

Related: [`SECURITY.md`](SECURITY.md) §1 (secrets & confidential data from commit zero).

## 3. Every path that resets a store must answer: can a human still get in?

**A backup, export, or restore feature has to state in its contract whether it carries
identity.** Not in a code comment — in the contract, where the people building the *other*
rebuild paths will read it.

Authentication state (users, sessions, credentials) and domain state usually live on separate
tracks, and nothing forces anyone to write down which one a snapshot contains. When that
sentence is missing, every rebuild path inherits the gap **independently**, and each failure
looks like its own unrelated bug:

- restore completes successfully and leaves nobody able to sign in;
- a seed script produces a store no one has an account on;
- a screenshot or demo script silently captures the login page instead of the app.

One missing sentence, three symptoms, in three files that never reference each other.

So make **"can a human still sign in to this?"** a checklist line on *every* path that resets,
seeds, or restores a store — **including dev, demo, and tooling paths**, which is where it goes
unnoticed longest precisely because nobody's real data is at stake there.

Two corollaries worth stating once:

- **Adding an always-on auth gate changes the meaning of every unauthenticated script in the
  repo.** Introducing one should trigger a sweep of them, not just a pass over the app.
- This is the deployment-side face of the Definition of Done's **cold-start check**
  ([`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) §2). Same question, asked of an
  existing store instead of an empty one.

## 4. A demo instance is a second stack, not a mode

Eventually you need a deployment you can hand to a person, or screenshot, without the real
data anywhere near it. The naive version is an in-app demo mode — a flag that seeds sample
data and self-provisions a login. **Don't.** That puts demo data and a self-provisioning
credential *inside the production artifact*, guarded by a flag someone can flip.

The shape that works is a **second stack off the same image and tag**, where the production
build deliberately excludes the demo seeder — so demo data is *absent* from the real artifact
rather than merely disabled in it.

The isolation has to be **structural, not conventional**:

1. **Same image and tag as production.** A demo built from a different artifact proves nothing
   about the thing you are showing.
2. **Pin the project/stack name inside the stack file.** Many orchestrators derive it from the
   parent directory, so two stack files in one `deploy/` directory silently share containers
   and volumes. Give the demo its own volume, network, and signing secret under **distinct
   variable names**, so it cannot inherit production's by accident.
3. **Hard-wire the datastore URL to the demo's own service.** Never interpolate it from the
   environment — an operator with production values exported would otherwise aim the demo box
   at the real database, and nothing would object.
4. **Publish the credential and document it.** A demo whose password is generated per run is
   not one you can hand to anyone. It is safe because the data is synthetic and the box is
   isolated — not because the password is secret. (Generated *infrastructure* secrets stay
   ignored by source control as usual.)
5. **One `refresh` command that re-pristines between showings**, restoring the **credential**
   as well as the data — a viewer can change the password, and the reset path should also
   revoke their session.
6. **State the cost you are accepting:** keeping the seeder out of the production image means
   the box cannot seed itself, so seeding runs from a checkout. That is the correct trade, but
   it should be written down rather than rediscovered by whoever tries to reseed it.

Distinct from **demo *assets*** (screenshots and video), which have their own capture pattern —
[`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) §4.

## 5. Prove the isolation statically — it is the cheapest check you own

Everything §4 claims is testable **without starting a single container**, and the tier that
needs nothing running is the tier guarding the actual catastrophe.

Most orchestrators can render a stack to a machine-readable form (e.g. `docker compose config`)
without launching anything. So each isolation guarantee becomes one command run with a
**deliberately hostile environment exported** — put the real `DATABASE_URL` in, and assert the
demo's own service still comes out. Cheap enough that there is no excuse to skip it, and it
belongs in the **first** tier of the harness, before any build or `up`. The live tier — seeded
shape, credential, teardown — is the slow, fragile half and guards less.

Four rules for such a harness:

- **Assert the counterfactual too**, so a reader can see the hazard is live rather than
  theoretical: show that the *unpinned* stack really does resolve to the parent directory name.
  That is *why* pinning matters.
- **Drive the operator script; never reimplement its steps.** The behaviour worth pinning
  ("`refresh` re-pristines a dirtied box **and** revokes the previous viewer's session") is a
  property *of the script*. A harness that re-ran the underlying commands would pin its own
  copy while the real script rotted. This needs one deliberate seam in the script — an
  overridable env-file path — so the harness can run it against throwaway secrets and ports.
- **Leave the host as you found it, and *assert* that rather than assuming it** — snapshot
  containers and volumes before, diff after.
- **Verify each load-bearing check fails against an injected defect** before trusting the
  green: unpin the name, interpolate the URL, delete a step from the operator script
  ([`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) §5).

One trap specific to seeded-data harnesses: **the exact-count assertion is where they go
flaky.** If seeded volume depends on a window anchored on *today* — and especially if that
"today" is UTC via a timestamp conversion rather than local time — an observed count is an
artifact of the day it was observed. Assert the constants that really are constant, a floor
for the rest, and pin the exact number **relatively**: the same count before and after a
re-seed, guarded on the run not straddling midnight in whichever zone the code uses.
