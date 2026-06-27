// Self-contained sample data — the spike tests rendering/styling/routing/a11y, not API wiring.
// Mirrors the real Account Register's TransactionView shape closely enough to be representative.

export type Cents = number;

export function formatCents(c: Cents): string {
  const sign = c < 0 ? "-" : "";
  return `${sign}$${(Math.abs(c) / 100).toFixed(2)}`;
}

export interface Txn {
  id: string;
  occurredOn: string;
  payee: string;
  amountCents: Cents;
  unallocatedCents: Cents;
}

export interface Envelope {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  name: string;
  balanceCents: Cents;
}

export const ACCOUNTS: Account[] = [{ id: "chk", name: "Joint Checking", balanceCents: 482310 }];

export const ENVELOPES: Envelope[] = [
  { id: "e1", name: "Groceries" },
  { id: "e2", name: "Rent" },
  { id: "e3", name: "Dining out" },
  { id: "e4", name: "Transport" },
  { id: "e5", name: "Vacation fund" },
];

export const TXNS: Txn[] = [
  { id: "t1", occurredOn: "2026-06-01", payee: "Opening balance", amountCents: 500000, unallocatedCents: 0 },
  { id: "t2", occurredOn: "2026-06-03", payee: "Trader Joe's", amountCents: -8742, unallocatedCents: 0 },
  { id: "t3", occurredOn: "2026-06-05", payee: "ACME Payroll", amountCents: 320000, unallocatedCents: 120000 },
  { id: "t4", occurredOn: "2026-06-09", payee: "Shell", amountCents: -5210, unallocatedCents: 0 },
  { id: "t5", occurredOn: "2026-06-12", payee: "Landlord", amountCents: -185000, unallocatedCents: 0 },
  { id: "t6", occurredOn: "2026-06-15", payee: "Chipotle", amountCents: -2436, unallocatedCents: -2436 },
];

export function accountById(id: string | undefined): Account {
  return ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
}
