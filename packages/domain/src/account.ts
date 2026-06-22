import { type NameValidation, validateName } from "./naming";

export const ACCOUNT_KINDS = ["checking", "savings", "credit", "loan", "cash", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export function isAccountKind(x: string): x is AccountKind {
  return (ACCOUNT_KINDS as readonly string[]).includes(x);
}

/** Account kinds whose balance represents money OWED (a liability): a negative balance = debt. */
export const LIABILITY_KINDS = ["credit", "loan"] as const satisfies readonly AccountKind[];

/**
 * Is this a liability account (credit card / loan)? Liability balances are stored signed — a
 * negative balance means money owed (ADR-0003 + `v_account_balances`), exactly the `owed = −balance`
 * convention #14a/#14b read — so for net worth they sum in as-is and pull the total down. Every
 * other kind (checking/savings/cash/other) is an asset.
 */
export function isLiabilityKind(kind: AccountKind): boolean {
  return (LIABILITY_KINDS as readonly AccountKind[]).includes(kind);
}

export interface Account {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: AccountKind;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
}

export function validateAccountName(raw: string): NameValidation {
  return validateName(raw, "Account");
}
