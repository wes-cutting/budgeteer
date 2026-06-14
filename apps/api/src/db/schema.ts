// Kysely table interfaces — the PHYSICAL schema from docs/05_DATA_MODEL.md.
// Money is BIGINT integer cents (ADR-0003): read back as a string (bigint), written as a number.

import type { ColumnType, Generated } from "kysely";

/** bigint cents: SELECT yields a string; INSERT/UPDATE take a number. */
type IntCents = ColumnType<string, number, number>;
/** date column: only ever written (as 'YYYY-MM-DD'). */
type DateOnly = ColumnType<string, string, string>;

export interface DB {
  households: HouseholdsTable;
  accounts: AccountsTable;
  envelopes: EnvelopesTable;
  transactions: TransactionsTable;
  allocations: AllocationsTable;
  templates: TemplatesTable;
  template_lines: TemplateLinesTable;
  v_account_balances: AccountBalancesView;
  v_envelope_balances: EnvelopeBalancesView;
}

interface HouseholdsTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
}

interface AccountsTable {
  id: Generated<string>;
  household_id: string;
  name: string;
  kind: string;
  created_at: Generated<Date>;
  archived_at: Date | null;
}

interface EnvelopesTable {
  id: Generated<string>;
  household_id: string;
  name: string;
  kind: string;
  created_at: Generated<Date>;
  archived_at: Date | null;
}

interface TransactionsTable {
  id: Generated<string>;
  household_id: string;
  account_id: string;
  amount_cents: IntCents;
  kind: string;
  occurred_on: DateOnly;
  payee: string | null;
  memo: string | null;
  created_at: Generated<Date>;
}

interface AllocationsTable {
  id: Generated<string>;
  transaction_id: string;
  envelope_id: string;
  amount_cents: IntCents;
}

interface TemplatesTable {
  id: Generated<string>;
  household_id: string;
  name: string;
  created_at: Generated<Date>;
}

interface TemplateLinesTable {
  id: Generated<string>;
  template_id: string;
  envelope_id: string;
  amount_cents: IntCents;
  position: number;
}

interface AccountBalancesView {
  account_id: string;
  balance_cents: string;
}

interface EnvelopeBalancesView {
  envelope_id: string;
  balance_cents: string;
}
