import { type Kysely, sql } from "kysely";

/**
 * 0004 — make first-run setup atomic (BUD-S92 · SECURITY.md §3).
 *
 * `POST /auth/setup` gated on "zero users exist" with a separate count, then inserted — a
 * check-then-insert that `SECURITY.md` §3 recorded as an *accepted* race, partly on the grounds
 * that the endpoint was obscure. BUD-S92 puts it behind a discoverable screen, so the acceptance no
 * longer holds and the race is closed here instead.
 *
 * `bootstrap` marks the row created by first-run setup, and the partial unique index admits exactly
 * one such row per store. That is what makes the winner of a concurrent first setup a decision of
 * the DATABASE rather than of a count that raced: the route's
 * `insert … select … where not exists (select 1 from users)` handles the ordinary case, but under
 * READ COMMITTED two concurrent transactions can both find the table empty (neither sees the
 * other's uncommitted row) and both proceed to insert. The second then blocks on this index and
 * fails with `23505`, which the route maps to the existing `409`.
 *
 * Scoped to the bootstrap row ON PURPOSE — a household may have many admins (BUD-S88 adds them and
 * BUD-S89's last-admin guard assumes more than one is possible), so the constraint may not be
 * "one admin". It is "one first-run bootstrap".
 *
 * Existing stores adopt this cleanly: a first admin created before this migration keeps
 * `bootstrap = false`, and the `where not exists` guard is what stops setup running again there.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table users add column bootstrap boolean not null default false`.execute(db);
  await sql`create unique index users_one_bootstrap on users (bootstrap) where bootstrap`.execute(
    db,
  );
}
