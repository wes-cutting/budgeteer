#!/usr/bin/env bash
# ============================================================================
# validate-deploy.sh — prove the production image actually deploys (BUD-S82)
#
# Builds the ARM64 image, brings up deploy/compose.yaml against a real
# PostgreSQL 16, and exercises the deployed surface end to end: readiness,
# the SPA, the default-deny gate, a login, a write, and — the one PGlite can
# never tell you — that the write is really in Postgres.
#
# Shell rather than the repo's usual tsx scripts: this drives docker/compose
# and must run on a box (CI runner, the Pi) that need not have the toolchain
# installed. Secrets are generated per-run and never written to disk.
#
#   ./scripts/validate-deploy.sh
#
# Everything it creates is torn down on exit, including the volume — this
# harness must never leave state behind, least of all a database.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_TAG="${BUDGETEER_IMAGE:-budgeteer:validate}"
# Not 3001: the owner's dev stack lives there and respawns itself.
HOST_PORT="${BUDGETEER_PORT:-3099}"
PROJECT="budgeteer-validate"
BASE="http://127.0.0.1:${HOST_PORT}"

export BUDGETEER_IMAGE="$IMAGE_TAG"
export BUDGETEER_PORT="$HOST_PORT"
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"
export SESSION_SECRET="$(openssl rand -base64 48)"
# This harness talks plain http://, so Secure cookies would be unusable (a browser and curl both
# discard them). That is the real LAN-without-TLS shape, and the choice DEPLOY_CONTRACT §5 forces an
# operator to make; the Secure attribute itself is asserted in the API test suite.
export SESSION_COOKIE_SECURE=false

compose() { docker compose -p "$PROJECT" -f deploy/compose.yaml "$@"; }

cleanup() {
  echo "--- tearing down (containers + volume) ---"
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

pass=0
check() { # check <description> <actual> <expected>
  if [ "$2" = "$3" ]; then
    echo "  ok   $1"
    pass=$((pass + 1))
  else
    fail "$1 — expected '$3', got '$2'"
  fi
}

echo "--- building $IMAGE_TAG (linux/arm64) ---"
docker build --platform linux/arm64 -t "$IMAGE_TAG" . >/dev/null

echo "--- starting the stack ---"
cleanup
compose up -d >/dev/null

echo "--- waiting for readiness ---"
ready=""
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health" 2>/dev/null)" = "200" ]; then
    ready=yes
    break
  fi
  sleep 2
done
[ -n "$ready" ] || { compose logs app; fail "the app never became ready"; }

echo "--- readiness (BUD-S82) ---"
check "/health reports the database, not just the process" \
  "$(curl -s "$BASE/api/health")" '{"status":"ok","db":"ok"}'
# The image's HEALTHCHECK has a start period before its first probe, so poll for the verdict
# instead of sampling once and reading "starting" as a failure.
health=""
for _ in $(seq 1 45); do
  health="$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q app)")"
  [ "$health" = "starting" ] || break
  sleep 2
done
check "the container is healthy by its own HEALTHCHECK" "$health" "healthy"

echo "--- the SPA is served by the API process (BUD-S81) ---"
check "GET / returns the shell" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" "200"
# The paths that used to collide with the API. Each must serve the app, not JSON — this is the
# deployed proof of what the /api prefix was introduced to fix.
for route in /accounts /envelopes /templates /recurring /users /envelopes/some-id; do
  check "client route $route deep-links to the shell" \
    "$(curl -s "$BASE$route" | grep -c '<div id="root">' || true)" "1"
done
check "the SPA calls the API same-origin (no baked-in localhost:3001)" \
  "$(curl -s "$BASE/" | grep -c 'localhost:3001' || true)" "0"

echo "--- the gate is still default-deny (ADR-0009) ---"
check "an anonymous read is refused" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/accounts")" "401"
check "the ledger export is refused" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/export")" "401"

echo "--- a real session, end to end ---"
# The stack runs with SESSION_COOKIE_SECURE=false (see the export at the top): this harness speaks
# plain http://, and a Secure cookie is unusable over plain HTTP — curl refuses to store one, exactly
# as a browser would discard it. That is the DEPLOY_CONTRACT §5 trap, and it is asserted where it can
# be done deterministically, in `apps/api/test/auth.test.ts`, rather than by restarting containers
# mid-run here.
ADMIN_PW="validate-$(openssl rand -hex 8)"
# ONE credentials string, built once and reused verbatim by setup and login. Escaped JSON written
# inline inside a "$( ... )" is easy to get subtly wrong, and the failure it produces — a 201 setup
# followed by a 401 login — reads like an auth bug rather than a quoting one.
CREDS="$(printf '{"username":"validator","password":"%s"}' "$ADMIN_PW")"
check "first-run setup creates the admin" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/setup" \
     -H 'content-type: application/json' -d "$CREDS")" "201"

COOKIE_JAR="$(mktemp)"
LOGIN_HDRS="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$LOGIN_HDRS"; cleanup' EXIT
check "login issues a session" \
  "$(curl -s -c "$COOKIE_JAR" -D "$LOGIN_HDRS" -o /dev/null -w '%{http_code}' \
     -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d "$CREDS")" "200"

# A session that logs in but doesn't stick is the confusing failure this whole slice is about, so
# show the evidence rather than just a status code: the Set-Cookie the server sent and what the
# client actually kept. An empty jar next to a Secure cookie is the TLS trap (DEPLOY_CONTRACT §5).
session_status="$(curl -s -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' "$BASE/api/accounts")"
if [ "$session_status" != "200" ]; then
  echo "--- login response headers ---"; grep -i '^set-cookie' "$LOGIN_HDRS" || echo "(no Set-Cookie)"
  echo "--- cookies the client kept ---"; grep -v '^#' "$COOKIE_JAR" | grep . || echo "(jar is empty)"
fi
check "the session unlocks the API" "$session_status" "200"

echo "--- writes land in PostgreSQL, not an in-process store ---"
check "a write succeeds" \
  "$(curl -s -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/envelopes" \
     -H 'content-type: application/json' -d '{"name":"Deploy Validation"}')" "201"
# Read it back out of Postgres directly — the check PGlite could never satisfy, and the one that
# proves migrate-on-boot ran against the real server.
check "the row is visible in Postgres itself" \
  "$(compose exec -T db psql -U budgeteer -d budgeteer -tAc \
     "select name from envelopes where name = 'Deploy Validation'")" "Deploy Validation"
check "migrate-on-boot recorded its migrations" \
  "$(compose exec -T db psql -U budgeteer -d budgeteer -tAc \
     "select count(*) >= 3 from kysely_migration")" "t"

echo "--- backup → reset → restore, on Postgres (BUD-S85) ---"
# SPIKE-09 proved this round-trip on PGlite. Re-proving it on real Postgres is the point: the
# restore path writes through a different dialect, and restore is CLI-ONLY by design (no HTTP
# import — SEC3), so it can only be exercised against a deployed container.
BACKUP_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$BACKUP_FILE"; cleanup' EXIT
curl -s -b "$COOKIE_JAR" -o "$BACKUP_FILE" "$BASE/api/export"
check "the export contains the row" \
  "$(grep -c 'Deploy Validation' "$BACKUP_FILE" || true)" "1"

# The container runs as the non-root `node` user (Dockerfile), and `docker cp` preserves the host
# file's mode — mktemp creates 0600, so the copy lands unreadable inside. Real restores hit this too;
# DEPLOY_CONTRACT §7 says to make the backup world-readable before copying it in.
chmod 644 "$BACKUP_FILE"
docker cp "$BACKUP_FILE" "$(compose ps -q app)":/tmp/backup.json
compose exec -T app node apps/api/dist/db/reset.js >/dev/null
check "reset empties the ledger" \
  "$(compose exec -T db psql -U budgeteer -d budgeteer -tAc \
     "select count(*) from envelopes")" "0"

compose exec -T app node apps/api/dist/db/restore.js /tmp/backup.json >/dev/null
check "restore brings the ledger back" \
  "$(compose exec -T db psql -U budgeteer -d budgeteer -tAc \
     "select name from envelopes where name = 'Deploy Validation'")" "Deploy Validation"

# The sharp edge, asserted rather than assumed: `reset` truncates `households` CASCADE, and
# `users.household_id` references it — so the accounts go with it, and the backup does NOT carry
# users. A restored box has its ledger and NOBODY who can log in until `create-admin` runs again.
# Pinned here so the recovery runbook in DEPLOY_CONTRACT.md §7 can never silently drift from it.
check "restore leaves no user accounts — create-admin is required afterwards" \
  "$(compose exec -T db psql -U budgeteer -d budgeteer -tAc "select count(*) from users")" "0"

ADMIN_PW2="validate-$(openssl rand -hex 8)"
compose exec -T -e ADMIN_USERNAME=validator2 -e ADMIN_PASSWORD="$ADMIN_PW2" \
  app node apps/api/dist/cli/create-admin.js >/dev/null
check "create-admin restores access to the recovered ledger" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
     -H 'content-type: application/json' \
     -d "{\"username\":\"validator2\",\"password\":\"$ADMIN_PW2\"}")" "200"

echo "--- restart survival ---"
compose restart app >/dev/null
for _ in $(seq 1 45); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health" 2>/dev/null)" = "200" ] && break
  sleep 2
done
check "data survives a container restart" \
  "$(compose exec -T db psql -U budgeteer -d budgeteer -tAc \
     "select count(*) from envelopes where name = 'Deploy Validation'")" "1"

echo
echo "PASS — $pass deployment checks green against PostgreSQL 16."
