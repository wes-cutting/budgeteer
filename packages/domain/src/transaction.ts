import { type Cents, cents } from "./money";

export const TRANSACTION_KINDS = ["opening", "normal"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export interface Transaction {
  readonly id: string;
  readonly householdId: string;
  readonly accountId: string;
  /** Signed: deposit > 0, withdrawal < 0. Integer cents (ADR-0003). */
  readonly amountCents: Cents;
  readonly kind: TransactionKind;
  /** ISO calendar date, YYYY-MM-DD. */
  readonly occurredOn: string;
  readonly payee: string | null;
  readonly memo: string | null;
  readonly createdAt: Date;
}

/** Derived account balance = sum of the account's transaction amounts (incl. the opening txn). */
export function accountBalance(txns: readonly Pick<Transaction, "amountCents">[]): Cents {
  return cents(txns.reduce<number>((a, t) => a + t.amountCents, 0));
}
