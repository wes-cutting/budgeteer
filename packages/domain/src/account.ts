import { type NameValidation, validateName } from "./naming";

export const ACCOUNT_KINDS = ["checking", "savings", "credit", "loan", "cash", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export function isAccountKind(x: string): x is AccountKind {
  return (ACCOUNT_KINDS as readonly string[]).includes(x);
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
