#!/usr/bin/env bash
# ============================================================================
# validate-demo.sh — pin the demo profile (BUD-S96)
#
# BUD-S93 shipped the demo box and validated it thoroughly BY HAND; the checks
# survived only as prose in that slice's status report §4. This is that report,
# executable. It stands the demo stack up in its own compose project on its own
# ports, asserts what §4 asserted, and tears everything down.
#
#   ./scripts/validate-demo.sh
#
# Sibling of validate-deploy.sh, and the same shape: shell (it drives
# docker/compose), fail-fast, everything it creates removed on exit.
#
# IT DRIVES THE REAL DRIVER. The checks below run through
# scripts/demo-instance.sh, not through a reimplementation of it — `refresh`
# re-pristining a dirtied box is a property OF THAT SCRIPT, and a harness that
# reimplemented the steps would pin its own copy instead. The one thing that is
# swapped out is where the script reads its secrets and ports from
# (BUDGETEER_DEMO_ENV_FILE), so a run can never touch a demo box an operator has
# up on :3010.
#
# NOT A GATE STEP. It needs a container runtime, which makes it mutually
# exclusive with the e2e suite, exactly as validate-deploy.sh is. Run it by hand
# after touching deploy/compose.demo.yaml or scripts/demo-instance.sh.
#
# TWO TIERS. The isolation claims — the ones that matter most, because a demo
# box meeting the household's real ledger is the failure this profile exists to
# prevent — are asserted STATICALLY, from `docker compose config`, with no
# container started and a deliberately hostile environment exported. The rest
# needs a running box.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="deploy/compose.demo.yaml"
PROD_COMPOSE_FILE="deploy/compose.yaml"

# Its own project name, so `down --volumes` at the end can only ever reach this run's
# database. compose.demo.yaml pins `name: budgeteer-demo` IN THE FILE (which is the
# point of check 1 below), and COMPOSE_PROJECT_NAME is what outranks it — verified as a
# hard precondition before anything destructive runs.
PROJECT="budgeteer-demo-validate"
# Its own lane: 3001/5173 are the dev stack, 3002/5174 the cold-start e2e stack, 3010/5434
# the demo box itself, 3099 the deploy harness.
APP_PORT="${BUDGETEER_DEMO_VALIDATE_PORT:-3098}"
DB_PORT="${BUDGETEER_DEMO_VALIDATE_DB_PORT:-5435}"
BASE="http://127.0.0.1:${APP_PORT}"

# The credential DEPLOY_CONTRACT §10 publishes and demo-instance.sh restores. Spelled out
# here rather than sourced from the script, so that changing it in one place and not the
# other fails this harness instead of a live showing.
DEMO_USERNAME="demo"
DEMO_PASSWORD="demo-budgeteer"
# What a viewer leaves behind: data they entered, and a password they changed.
VIEWER_PASSWORD="changed-by-a-viewer"
STRAY_ENVELOPE="Left By A Viewer"

# Fixed constants in apps/api/src/db/seedDemo.ts (4 accounts · 22 envelopes · 1 paycheck
# rule + 7 bill rules · 3 templates). The TRANSACTION count is deliberately not among
# them: the seed window is "6 prior months + the current month through today", so the
# exact number moves with the calendar, and an exact assertion here would be the
# relative-date fixture TESTING_STRATEGY §4 names as a smell. A floor is asserted instead,
# and the exact count is pinned RELATIVELY — the same number before and after `refresh`.
EXPECT_ACCOUNTS=4
EXPECT_ENVELOPES=22
EXPECT_RECURRING=8
EXPECT_TEMPLATES=3
MIN_TRANSACTIONS=120

# The demo stack's own variables must come from this run's env file and nowhere else. An
# operator with them exported would otherwise have compose read one value (shell wins over
# --env-file) while demo-instance.sh reads another (it greps the file), and the seed would
# fail against a password mismatch that looks like a database bug.
unset DEMO_POSTGRES_PASSWORD DEMO_SESSION_SECRET BUDGETEER_DEMO_PORT BUDGETEER_DEMO_DB_PORT \
  BUDGETEER_DEMO_COOKIE_SECURE COMPOSE_PROJECT_NAME 2>/dev/null || true

ENV_FILE=""
JAR_VIEWER=""
JAR_DEMO=""

fail() { echo "FAIL: $*" >&2; exit 1; }

cleanup() {
  if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
    echo "--- tearing down (containers + volume) ---"
    compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -f "$ENV_FILE" "$JAR_VIEWER" "$JAR_DEMO" 2>/dev/null || true
}
trap cleanup EXIT

pass=0
check() { # check <description> <actual> <expected>
  if [ "$2" = "$3" ]; then
    echo "  ok   $1"
    pass=$((pass + 1))
  else
    fail "$1 — expected '$3', got '$2'"
  fi
}

check_at_least() { # check_at_least <description> <actual> <floor>
  if [ "$2" -ge "$3" ] 2>/dev/null; then
    echo "  ok   $1 ($2 >= $3)"
    pass=$((pass + 1))
  else
    fail "$1 — expected at least '$3', got '$2'"
  fi
}

need() { command -v "$1" >/dev/null 2>&1 || fail "$1 is required — $2"; }

# ── preflight ───────────────────────────────────────────────────────────────
echo "--- preflight ---"
need docker "start a container runtime (colima start)"
need curl "it drives the deployed HTTP surface"
need jq "the static isolation checks read \`docker compose config --format json\`"
need openssl "per-run secrets are generated, never reused"
# `up` and `refresh` seed from THIS checkout: seedDemo is deliberately not in the
# production image (BUD-S93 §2), so those two steps are the ones that need a toolchain.
need npm "seeding runs from this checkout — see SEEDING in scripts/demo-instance.sh"
[ -d node_modules ] || fail "run 'npm install' first — seeding runs from this checkout"
docker info >/dev/null 2>&1 || fail "no container runtime is reachable — run 'colima start'"

port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }
for p in "$APP_PORT" "$DB_PORT"; do
  ! port_in_use "$p" || fail "port $p is already in use — this harness needs $APP_PORT and $DB_PORT free"
done
# Not a hard failure, but the e2e suite and this harness cannot share a machine.
for p in 3001 5173 3002 5174; do
  if port_in_use "$p"; then
    echo "  note: something is listening on $p — never run this harness alongside e2e or the dev stack"
  fi
done

# ── this run's secrets and ports ────────────────────────────────────────────
# Generated per run and written to a temp file that is removed on exit — the operator's
# deploy/.env.demo is never read, written, or moved aside. demo-instance.sh reads this
# file instead because of the BUDGETEER_DEMO_ENV_FILE seam.
RUN_DB_PASSWORD="$(openssl rand -hex 16)"
RUN_SESSION_SECRET="$(openssl rand -base64 48)"
IMAGE_TAG="${BUDGETEER_IMAGE:-budgeteer:demo-validate}"
BUILD_IMAGE=yes
[ -z "${BUDGETEER_IMAGE:-}" ] || BUILD_IMAGE=no

ENV_FILE="$(mktemp)"
chmod 600 "$ENV_FILE"
cat > "$ENV_FILE" <<EOF
# Generated by scripts/validate-demo.sh for one run; deleted on exit. Never committed.
DEMO_POSTGRES_PASSWORD=$RUN_DB_PASSWORD
DEMO_SESSION_SECRET=$RUN_SESSION_SECRET
BUDGETEER_DEMO_PORT=$APP_PORT
BUDGETEER_DEMO_DB_PORT=$DB_PORT
BUDGETEER_IMAGE=$IMAGE_TAG
EOF

export BUDGETEER_DEMO_ENV_FILE="$ENV_FILE"
export COMPOSE_PROJECT_NAME="$PROJECT"

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
demo() { ./scripts/demo-instance.sh "$@"; }
demo_config() { compose config --format json; }
# The production stack as an operator would render it: this run's overrides (the project
# name, and the locally built image tag) must not leak into the thing being compared against.
prod_config() {
  env -u COMPOSE_PROJECT_NAME -u BUDGETEER_IMAGE POSTGRES_PASSWORD=unused SESSION_SECRET=unused \
    docker compose -f "$PROD_COMPOSE_FILE" config --format json
}

# ── tier 1: the isolation claims, with nothing running ──────────────────────
# These are the claims BUD-S93 called "structural, not conventional", and they are the
# cheapest checks in the file: `compose config` renders the stack without starting it, so
# a hostile environment can be exported at each one and the answer read straight back.
echo "--- isolation, asserted statically (BUD-S93 §1) ---"

# The footgun: a compose project takes its name from the parent directory unless pinned.
# Run WITHOUT COMPOSE_PROJECT_NAME, which is the situation an operator is actually in.
check "the demo stack pins its own compose project inside the file" \
  "$(env -u COMPOSE_PROJECT_NAME docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
     config --format json | jq -r '.name')" "budgeteer-demo"
# The counterfactual that makes the line above worth asserting: the production stack does
# NOT pin a name, so unpinned it becomes `deploy` — which is what the demo stack would also
# have been called, in the same directory, sharing containers and volumes.
check "the counterfactual: the production stack, unpinned, is project 'deploy'" \
  "$(prod_config | jq -r '.name')" "deploy"

check "the demo stack declares its own volume" \
  "$(demo_config | jq -r '.volumes | keys | join(",")')" "budgeteer-demo-db"
check "...and the production stack's volume is a different name" \
  "$(prod_config | jq -r '.volumes | keys | join(",")')" "budgeteer-db"

# The other footgun: an operator with production values exported must not be able to aim
# the demo container at the household's database, or sign its cookies with the real key.
check "an exported DATABASE_URL cannot aim the demo box at another database" \
  "$(DATABASE_URL='postgres://real:real@household-db:5432/budgeteer' demo_config \
     | jq -r '.services.app.environment.DATABASE_URL')" \
  "postgres://budgeteer:${RUN_DB_PASSWORD}@db:5432/budgeteer"
check "an exported SESSION_SECRET cannot become the demo signing key" \
  "$(SESSION_SECRET='the-real-production-signing-key' demo_config \
     | jq -r '.services.app.environment.SESSION_SECRET')" "$RUN_SESSION_SECRET"

# Fails by name, before starting anything — the claim in DEPLOY_CONTRACT §10.
missing_secret_error() { # missing_secret_error [VAR=value ...] — prints stderr, swallows exit
  env "$@" docker compose --env-file /dev/null -f "$COMPOSE_FILE" config 2>&1 >/dev/null || true
}
check "no DEMO_POSTGRES_PASSWORD: the stack refuses, naming the variable" \
  "$(missing_secret_error | grep -c 'DEMO_POSTGRES_PASSWORD is required' || true)" "1"
check "no DEMO_SESSION_SECRET: the stack refuses, naming the variable" \
  "$(missing_secret_error DEMO_POSTGRES_PASSWORD=set | grep -c 'DEMO_SESSION_SECRET is required' || true)" "1"

# The same artifact as production — a demo built from a different image proves nothing
# about what you are showing someone (K43). Read with BUDGETEER_IMAGE unset, since this
# run overrides it to a locally built tag.
check "the demo box defaults to the same image as production" \
  "$(env -u BUDGETEER_IMAGE DEMO_POSTGRES_PASSWORD=x DEMO_SESSION_SECRET=y \
     docker compose --env-file /dev/null -f "$COMPOSE_FILE" config --format json \
     | jq -r '.services.app.image')" \
  "$(prod_config | jq -r '.services.app.image')"

# The two deliberate deviations from the production stack (DEPLOY_CONTRACT §10). Asserted
# so that neither can be "tidied up" into matching production without this going red.
check "the demo database port is published to loopback only" \
  "$(demo_config | jq -r '.services.db.ports[0].host_ip')" "127.0.0.1"
check "SESSION_COOKIE_SECURE defaults to false on the demo box" \
  "$(demo_config | jq -r '.services.app.environment.SESSION_COOKIE_SECURE')" "false"
check "...against true in production, which is the deviation being recorded" \
  "$(prod_config | jq -r '.services.app.environment.SESSION_COOKIE_SECURE')" "true"

# ── the precondition everything destructive depends on ──────────────────────
# If COMPOSE_PROJECT_NAME did not outrank the pinned `name:`, every command below would be
# operating on the operator's demo box — and the last one is `down --volumes`. Refuse to
# continue unless the override demonstrably took.
effective_project="$(demo_config | jq -r '.name')"
[ "$effective_project" = "$PROJECT" ] || fail \
  "the project override did not take (compose reports '$effective_project'); refusing to run, because teardown drops volumes"
echo "  ok   the run is isolated to project '$PROJECT'"
pass=$((pass + 1))

# What this host already had. Nothing below may remove any of it.
CONTAINERS_BEFORE="$(docker ps -aq | sort)"
VOLUMES_BEFORE="$(docker volume ls -q | sort)"

# ── tier 2: a running demo box ──────────────────────────────────────────────
if [ "$BUILD_IMAGE" = yes ]; then
  echo "--- building $IMAGE_TAG (linux/arm64) ---"
  docker build --platform linux/arm64 -t "$IMAGE_TAG" . >/dev/null
else
  echo "--- using the supplied image $IMAGE_TAG (no build) ---"
fi

echo "--- ./scripts/demo-instance.sh up ---"
compose down --volumes --remove-orphans >/dev/null 2>&1 || true
demo up

psql_count() { compose exec -T db psql -U budgeteer -d budgeteer -tAc "$1" | tr -d '[:space:]'; }

echo "--- the box is up and reports its database (BUD-S82) ---"
check "/api/health reports the database, not just the process" \
  "$(curl -s "$BASE/api/health")" '{"status":"ok","db":"ok"}'

echo "--- it serves seeded, strictly synthetic data (BUD-S93 §4) ---"
check "accounts" "$(psql_count 'select count(*) from accounts')" "$EXPECT_ACCOUNTS"
check "envelopes" "$(psql_count 'select count(*) from envelopes')" "$EXPECT_ENVELOPES"
check "recurring rules" \
  "$(psql_count 'select count(*) from recurring_transactions')" "$EXPECT_RECURRING"
check "templates" "$(psql_count 'select count(*) from templates')" "$EXPECT_TEMPLATES"
TXNS_SEEDED="$(psql_count 'select count(*) from transactions')"
check_at_least "transactions (calendar-dependent, so a floor)" "$TXNS_SEEDED" "$MIN_TRANSACTIONS"
# seedDemo anchors its window on todayStr(), which is toISOString() — UTC, not local. Noted
# here because the refresh check below compares the two seeds row for row, and that is only
# a fair comparison if both fell on the same UTC day.
SEED_DAY="$(date -u +%F)"
# The dataset is invented by construction (seedDemo.ts), and one named payee from it is
# cheap proof that THIS box is serving THAT dataset rather than something else.
check "the ledger holds the synthetic payees, not a real one" \
  "$(psql_count "select count(*) > 0 from transactions where payee = 'Northwind Payroll'")" "t"

echo "--- the gate is still default-deny while anonymous (ADR-0009) ---"
check "an anonymous read is refused" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/accounts")" "401"
check "the ledger export is refused" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/export")" "401"
check "a claimed box refuses a second first-run setup" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/setup" \
     -H 'content-type: application/json' \
     -d '{"username":"squatter","password":"squatter-password"}')" "409"

echo "--- the documented credential is the one that works (DEPLOY_CONTRACT §10) ---"
JAR_DEMO="$(mktemp)"
login() { # login <jar> <username> <password>
  curl -s -c "$1" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
    -H 'content-type: application/json' \
    -d "$(printf '{"username":"%s","password":"%s"}' "$2" "$3")"
}
check "the published credential signs in" \
  "$(login "$JAR_DEMO" "$DEMO_USERNAME" "$DEMO_PASSWORD")" "200"
check "the session serves the seeded ledger over HTTP, not just in the database" \
  "$(curl -s -b "$JAR_DEMO" "$BASE/api/accounts" | jq -r '.accounts | length')" "$EXPECT_ACCOUNTS"

echo "--- it shares nothing with anything else on this host (BUD-S93 §4) ---"
APP_CID="$(compose ps -q app)"
check "the app container sits on exactly one network" \
  "$(docker inspect --format '{{len .NetworkSettings.Networks}}' "$APP_CID")" "1"
check "...and that network belongs to this run's project" \
  "$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$APP_CID")" \
  "${PROJECT}_default"
check "the only volume in this project is its own database" \
  "$(docker volume ls -q --filter "label=com.docker.compose.project=${PROJECT}")" \
  "${PROJECT}_budgeteer-demo-db"
# `db` inside the app container must resolve to this project's database and nothing else.
check "'db' resolves to this project's database container" \
  "$(compose exec -T app node -e \
     'require("dns").promises.lookup("db").then(r => console.log(r.address))' | tr -d '[:space:]')" \
  "$(docker inspect --format \
     "{{(index .NetworkSettings.Networks \"${PROJECT}_default\").IPAddress}}" "$(compose ps -q db)")"

# ── refresh: the answer to what a showing leaves behind ─────────────────────
echo "--- dirtying the box the way a showing dirties it ---"
check "a viewer leaves data behind" \
  "$(curl -s -b "$JAR_DEMO" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/envelopes" \
     -H 'content-type: application/json' \
     -d "$(printf '{"name":"%s"}' "$STRAY_ENVELOPE")")" "201"
check "the stray envelope is there" \
  "$(psql_count 'select count(*) from envelopes')" "$((EXPECT_ENVELOPES + 1))"

USER_ID="$(curl -s -b "$JAR_DEMO" "$BASE/api/users" | jq -r '.users[0].id')"
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || fail "could not read the demo user's id"
check "a viewer changes the password" \
  "$(curl -s -b "$JAR_DEMO" -o /dev/null -w '%{http_code}' \
     -X POST "$BASE/api/users/$USER_ID/reset-password" -H 'content-type: application/json' \
     -d "$(printf '{"password":"%s"}' "$VIEWER_PASSWORD")")" "200"
check "the box no longer answers to the credential the runbook publishes" \
  "$(login "$(mktemp -u)" "$DEMO_USERNAME" "$DEMO_PASSWORD")" "401"

# The session a viewer is holding when they walk away. Taken AFTER the password change,
# because that change already revoked the earlier one.
JAR_VIEWER="$(mktemp)"
check "the viewer holds a live session" \
  "$(login "$JAR_VIEWER" "$DEMO_USERNAME" "$VIEWER_PASSWORD")" "200"
check "...that unlocks the API" \
  "$(curl -s -b "$JAR_VIEWER" -o /dev/null -w '%{http_code}' "$BASE/api/accounts")" "200"

echo "--- ./scripts/demo-instance.sh refresh ---"
demo refresh

echo "--- refresh re-pristined the box (BUD-S93 §4) ---"
check "the stray envelope is gone" \
  "$(psql_count "select count(*) from envelopes where name = '$STRAY_ENVELOPE'")" "0"
check "the envelope count is back to the seeded shape" \
  "$(psql_count 'select count(*) from envelopes')" "$EXPECT_ENVELOPES"
check "the accounts are back" "$(psql_count 'select count(*) from accounts')" "$EXPECT_ACCOUNTS"
# The exact transaction count, pinned relatively: the seed is deterministic for a given
# calendar day, so a re-seed on the same day must reproduce it exactly. If the run happened
# to straddle UTC midnight the two seeds used different windows and are not comparable —
# degrade to the floor and say so, rather than fail for a reason that is not a defect.
if [ "$(date -u +%F)" = "$SEED_DAY" ]; then
  check "the transactions are back, to the row" \
    "$(psql_count 'select count(*) from transactions')" "$TXNS_SEEDED"
else
  echo "  note: the run crossed UTC midnight, so the seed window moved between the two seeds"
  check_at_least "the transactions are back" \
    "$(psql_count 'select count(*) from transactions')" "$MIN_TRANSACTIONS"
fi
check "the published credential works again" \
  "$(login "$(mktemp -u)" "$DEMO_USERNAME" "$DEMO_PASSWORD")" "200"
check "the previous viewer's session was revoked" \
  "$(curl -s -b "$JAR_VIEWER" -o /dev/null -w '%{http_code}' "$BASE/api/accounts")" "401"
# BUD-S90: the in-container reset preserves households/users/sessions, which is why the
# demo account survives a refresh instead of having to be recreated.
check "refresh did not multiply the users" "$(psql_count 'select count(*) from users')" "1"

# ── teardown leaves nothing ─────────────────────────────────────────────────
echo "--- ./scripts/demo-instance.sh down --purge ---"
demo down --purge

check "no container of this project survives" \
  "$(docker ps -aq --filter "label=com.docker.compose.project=${PROJECT}" | wc -l | tr -d ' ')" "0"
check "no volume of this project survives" \
  "$(docker volume ls -q --filter "label=com.docker.compose.project=${PROJECT}" | wc -l | tr -d ' ')" "0"
check "no network of this project survives" \
  "$(docker network ls -q --filter "label=com.docker.compose.project=${PROJECT}" | wc -l | tr -d ' ')" "0"
# The check the isolation claim actually rests on: whatever this host had before the run,
# it still has. A demo harness that removed somebody's database would be the exact failure
# the demo profile exists to prevent.
check "every container that existed before the run still exists" \
  "$(comm -23 <(printf '%s\n' "$CONTAINERS_BEFORE") <(docker ps -aq | sort) | grep -c . || true)" "0"
check "every volume that existed before the run still exists" \
  "$(comm -23 <(printf '%s\n' "$VOLUMES_BEFORE") <(docker volume ls -q | sort) | grep -c . || true)" "0"

echo
echo "PASS — $pass demo-profile checks green (compose.demo.yaml + demo-instance.sh)."
