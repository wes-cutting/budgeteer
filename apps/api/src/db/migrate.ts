import { type Kysely, sql } from "kysely";
import type { DB } from "./schema";

/** V1 single implicit household (design-toward multi-household; no auth/RLS yet — ADR-0002). */
export const DEFAULT_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Forward-only schema creation realizing docs/05_DATA_MODEL.md. Idempotent (IF NOT EXISTS),
 * so it doubles as the dev/test migrator. A versioned migrator replaces this when the schema
 * starts to evolve; for the foundation a single forward migration is right-sized.
 */
export async function migrateToLatest(db: Kysely<DB>): Promise<void> {
  await sql`
    create table if not exists households (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      created_at timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table if not exists accounts (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      name text not null check (length(btrim(name)) > 0),
      kind text not null check (kind in ('checking','savings','credit','cash','other')),
      created_at timestamptz not null default now(),
      archived_at timestamptz
    )
  `.execute(db);
  await sql`
    create unique index if not exists accounts_household_name_uniq
      on accounts (household_id, lower(btrim(name)))
  `.execute(db);

  await sql`
    create table if not exists envelopes (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      name text not null check (length(btrim(name)) > 0),
      kind text not null default 'standard' check (kind in ('standard','sinking_fund')),
      created_at timestamptz not null default now(),
      archived_at timestamptz
    )
  `.execute(db);
  await sql`
    create unique index if not exists envelopes_household_name_uniq
      on envelopes (household_id, lower(btrim(name)))
  `.execute(db);

  // Transfer parent (ADR-0004) — created before transactions so the leg FK can reference it.
  await sql`
    create table if not exists transfers (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      occurred_on date not null,
      memo text,
      created_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`create index if not exists transfers_household_idx on transfers (household_id)`.execute(
    db,
  );

  await sql`
    create table if not exists transactions (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      account_id uuid not null references accounts(id),
      amount_cents bigint not null,
      kind text not null,
      occurred_on date not null,
      payee text,
      memo text,
      transfer_id uuid references transfers(id) on delete cascade,
      created_at timestamptz not null default now(),
      constraint normal_txn_nonzero check (kind <> 'normal' or amount_cents <> 0)
    )
  `.execute(db);
  // Evolve the kind check to allow 'transfer' (ADR-0004), idempotently and without plpgsql:
  // drop the foundation's inline check and any prior named variant, then (re)add ours.
  await sql`alter table transactions drop constraint if exists transactions_kind_check`.execute(db);
  await sql`alter table transactions drop constraint if exists transactions_kind_chk`.execute(db);
  await sql`
    alter table transactions
      add constraint transactions_kind_chk check (kind in ('opening','normal','transfer'))
  `.execute(db);
  // Defensive: a DB created before ADR-0004 won't have transfer_id from the create above.
  await sql`alter table transactions add column if not exists transfer_id uuid references transfers(id) on delete cascade`.execute(
    db,
  );
  await sql`create index if not exists transactions_account_idx on transactions (account_id)`.execute(
    db,
  );
  await sql`create index if not exists transactions_transfer_idx on transactions (transfer_id)`.execute(
    db,
  );
  await sql`
    create unique index if not exists transactions_one_opening_per_account
      on transactions (account_id) where kind = 'opening'
  `.execute(db);

  await sql`
    create table if not exists allocations (
      id uuid primary key default gen_random_uuid(),
      transaction_id uuid not null references transactions(id) on delete cascade,
      envelope_id uuid not null references envelopes(id),
      amount_cents bigint not null
    )
  `.execute(db);
  await sql`create index if not exists allocations_txn_idx on allocations (transaction_id)`.execute(
    db,
  );
  await sql`create index if not exists allocations_envelope_idx on allocations (envelope_id)`.execute(
    db,
  );

  // Envelope↔envelope reallocation (ADR-0004 B) — created before the balance view that reads it.
  await sql`
    create table if not exists envelope_transfers (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      from_envelope_id uuid not null references envelopes(id),
      to_envelope_id uuid not null references envelopes(id),
      amount_cents bigint not null check (amount_cents > 0),
      occurred_on date not null,
      memo text,
      created_at timestamptz not null default now(),
      constraint envelope_transfer_distinct check (from_envelope_id <> to_envelope_id)
    )
  `.execute(db);
  await sql`create index if not exists envelope_transfers_from_idx on envelope_transfers (from_envelope_id)`.execute(
    db,
  );
  await sql`create index if not exists envelope_transfers_to_idx on envelope_transfers (to_envelope_id)`.execute(
    db,
  );

  await sql`
    create or replace view v_account_balances as
      select a.id as account_id, coalesce(sum(t.amount_cents), 0)::bigint as balance_cents
      from accounts a left join transactions t on t.account_id = a.id
      group by a.id
  `.execute(db);
  // Two-source (ADR-0004): allocations + net envelope-transfer flow (incoming − outgoing).
  await sql`
    create or replace view v_envelope_balances as
      select e.id as envelope_id,
        (
          coalesce((select sum(al.amount_cents) from allocations al where al.envelope_id = e.id), 0)
          + coalesce((select sum(et.amount_cents) from envelope_transfers et where et.to_envelope_id = e.id), 0)
          - coalesce((select sum(et.amount_cents) from envelope_transfers et where et.from_envelope_id = e.id), 0)
        )::bigint as balance_cents
      from envelopes e
  `.execute(db);

  await sql`
    create table if not exists templates (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      name text not null check (length(btrim(name)) > 0),
      created_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`
    create unique index if not exists templates_household_name_uniq
      on templates (household_id, lower(btrim(name)))
  `.execute(db);

  await sql`
    create table if not exists template_lines (
      id uuid primary key default gen_random_uuid(),
      template_id uuid not null references templates(id) on delete cascade,
      envelope_id uuid not null references envelopes(id),
      amount_cents bigint not null check (amount_cents > 0),
      position integer not null
    )
  `.execute(db);
  await sql`create index if not exists template_lines_template_idx on template_lines (template_id)`.execute(
    db,
  );

  await sql`
    insert into households (id, name)
    values (${DEFAULT_HOUSEHOLD_ID}::uuid, 'Default household')
    on conflict (id) do nothing
  `.execute(db);
}
