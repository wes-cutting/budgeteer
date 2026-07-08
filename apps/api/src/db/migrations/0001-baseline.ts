import { type Kysely, sql } from "kysely";

/**
 * 0001 — baseline (EH9). The foundation's single idempotent migration function, frozen verbatim
 * the day the versioned migrator was adopted (2026-07-03; every statement is `if not exists` /
 * drop-then-add). The idempotence is what lets a pre-migrator store adopt the migrator: running
 * this against an already-created schema is a no-op that simply records the baseline as executed.
 *
 * FROZEN — never edit this file. Schema changes are new numbered migration files.
 * (The default-household seed row is deliberately NOT here: it must re-run at every startup so a
 * truncated store heals — it lives in `migrateToLatest`, not in a run-once migration.)
 */
export async function up(db: Kysely<unknown>): Promise<void> {
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
  // Evolve the kind check to allow 'loan' (FEAT-014b), idempotently and without plpgsql: drop the
  // foundation's inline check and any prior named variant, then (re)add ours. Existing rows (the
  // original 5 kinds) all satisfy the wider set, so this is safe.
  await sql`alter table accounts drop constraint if exists accounts_kind_check`.execute(db);
  await sql`alter table accounts drop constraint if exists accounts_kind_chk`.execute(db);
  await sql`
    alter table accounts
      add constraint accounts_kind_chk check (kind in ('checking','savings','credit','loan','cash','other'))
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

  // Recurring transactions (FEAT-009): a rule + its split lines; a "Post due" generator writes
  // concrete transactions and advances next_occurrence_on.
  await sql`
    create table if not exists recurring_transactions (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      account_id uuid not null references accounts(id),
      direction text not null check (direction in ('deposit','withdrawal')),
      amount_cents bigint not null check (amount_cents > 0),
      payee text,
      memo text,
      frequency text not null check (frequency in ('weekly','biweekly','monthly')),
      anchor_on date not null,
      next_occurrence_on date not null,
      created_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`create index if not exists recurring_household_idx on recurring_transactions (household_id)`.execute(
    db,
  );
  await sql`
    create table if not exists recurring_lines (
      id uuid primary key default gen_random_uuid(),
      recurring_id uuid not null references recurring_transactions(id) on delete cascade,
      envelope_id uuid not null references envelopes(id),
      amount_cents bigint not null check (amount_cents > 0),
      refund boolean not null default false,
      position integer not null
    )
  `.execute(db);
  await sql`create index if not exists recurring_lines_recurring_idx on recurring_lines (recurring_id)`.execute(
    db,
  );
  // Traceability link from a generated transaction back to its rule (kept on rule delete).
  await sql`alter table transactions add column if not exists recurring_id uuid references recurring_transactions(id) on delete set null`.execute(
    db,
  );
  await sql`create index if not exists transactions_recurring_idx on transactions (recurring_id)`.execute(
    db,
  );

  // Reconcile-to-bank (FEAT-010): a recorded compare of the derived balance vs. the real
  // statement balance. Manual; no per-transaction cleared concept in V1.
  await sql`
    create table if not exists reconciliations (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      account_id uuid not null references accounts(id),
      statement_balance_cents bigint not null,
      derived_balance_cents bigint not null,
      reconciled_on date not null,
      created_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`create index if not exists reconciliations_account_idx on reconciliations (account_id)`.execute(
    db,
  );

  // Per-envelope recurring monthly budget target (FEAT-012): one row per envelope (no row = no
  // target). The "budget" side of budget-vs-actual; the "actual" is a read-only aggregate over
  // allocations. Mutable config (not a ledger row), so it carries an updated_at.
  await sql`
    create table if not exists envelope_targets (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      envelope_id uuid not null references envelopes(id),
      monthly_target_cents bigint not null check (monthly_target_cents > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`
    create unique index if not exists envelope_targets_envelope_uniq
      on envelope_targets (envelope_id)
  `.execute(db);
  await sql`create index if not exists envelope_targets_household_idx on envelope_targets (household_id)`.execute(
    db,
  );

  // Per-credit-account credit limit (FEAT-014a): one row per account (no row = no limit). The
  // reference number for credit utilization (owed/limit); the "owed" side is the derived balance
  // (v_account_balances), never stored. Mutable config (not a ledger row), so it carries updated_at.
  // Only meaningful for kind='credit' accounts — enforced at the service boundary, not the schema.
  await sql`
    create table if not exists credit_limits (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      account_id uuid not null references accounts(id),
      credit_limit_cents bigint not null check (credit_limit_cents > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`
    create unique index if not exists credit_limits_account_uniq
      on credit_limits (account_id)
  `.execute(db);
  await sql`create index if not exists credit_limits_household_idx on credit_limits (household_id)`.execute(
    db,
  );

  // Per-loan-account original principal (FEAT-014b): one row per loan account (no row = no
  // principal). The reference number for debt **payoff** (1 − owed/original); the "owed" side is the
  // derived balance (v_account_balances), never stored. Mutable config (not a ledger row), so it
  // carries updated_at. Only meaningful for kind='loan' accounts — enforced at the service boundary.
  await sql`
    create table if not exists loan_principals (
      id uuid primary key default gen_random_uuid(),
      household_id uuid not null references households(id),
      account_id uuid not null references accounts(id),
      original_principal_cents bigint not null check (original_principal_cents > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db);
  await sql`
    create unique index if not exists loan_principals_account_uniq
      on loan_principals (account_id)
  `.execute(db);
  await sql`create index if not exists loan_principals_household_idx on loan_principals (household_id)`.execute(
    db,
  );
}
