import { type Kysely, sql } from "kysely";

/**
 * 0003 — authentication (BUD-E13 / ADR-0009). Adds `users` (household members who can sign in;
 * shape A = one household per user) and `sessions` (opaque, server-side, revocable — the cookie
 * carries only the token; a row is deleted on logout, password reset, or account disable).
 *
 * No passwords and no seed users here — a migration never carries a secret. The first admin is
 * created out-of-band: the `create-admin` CLI or the first-run `POST /auth/setup` (zero-users-only).
 * Forward-only and frozen once committed (see db/migrate.ts).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table users (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      username text not null check (length(btrim(username)) > 0),
      password_hash text not null,
      role text not null check (role in ('admin','member')),
      created_at timestamptz not null default now(),
      disabled_at timestamptz
    )
  `.execute(db);
  // Case-insensitive unique login handle (the boundary lowercases before writing/matching).
  await sql`create unique index users_username_uniq on users (lower(username))`.execute(db);

  await sql`
    create table sessions (
      id text primary key,
      user_id uuid not null references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    )
  `.execute(db);
  await sql`create index sessions_user_id_idx on sessions (user_id)`.execute(db);
}
