import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import type { Scope } from "./scope";
import { makeAccountService } from "./accountService";
import { makeEnvelopeService } from "./envelopeService";
import { makeTransactionService } from "./transactionService";
import { makeTransferService } from "./transferService";
import { makeEnvelopeTransferService } from "./envelopeTransferService";
import { makeRecurringService } from "./recurringService";
import { makeReconcileService } from "./reconcileService";
import { makeTemplateService } from "./templateService";
import { makeAnalysisService } from "./analysisService";
import { makeTargetService } from "./targetService";
import { makeCreditLimitService } from "./creditLimitService";
import { makeLoanPrincipalService } from "./loanPrincipalService";
import { makeBackupService } from "./backupService";

/**
 * The service container — built ONCE PER REQUEST, bound to the request's authorization `scope`
 * (ADR-0009 §2 · BUD-S86). Each service filters every query by `scope.householdId`, so a request
 * can only ever touch its own household's data; there is no unscoped default. Construction is
 * cheap (thin closures over `db`), so per-request is negligible.
 */
export interface Services {
  accounts: ReturnType<typeof makeAccountService>;
  envelopes: ReturnType<typeof makeEnvelopeService>;
  transactions: ReturnType<typeof makeTransactionService>;
  transfers: ReturnType<typeof makeTransferService>;
  envelopeTransfers: ReturnType<typeof makeEnvelopeTransferService>;
  recurring: ReturnType<typeof makeRecurringService>;
  reconcile: ReturnType<typeof makeReconcileService>;
  templates: ReturnType<typeof makeTemplateService>;
  analysis: ReturnType<typeof makeAnalysisService>;
  targets: ReturnType<typeof makeTargetService>;
  creditLimits: ReturnType<typeof makeCreditLimitService>;
  loanPrincipals: ReturnType<typeof makeLoanPrincipalService>;
  backup: ReturnType<typeof makeBackupService>;
}

/** Construct the whole service container bound to one request's `scope`. */
export function makeServices(db: Kysely<DB>, scope: Scope): Services {
  return {
    accounts: makeAccountService(db, scope),
    envelopes: makeEnvelopeService(db, scope),
    transactions: makeTransactionService(db, scope),
    transfers: makeTransferService(db, scope),
    envelopeTransfers: makeEnvelopeTransferService(db, scope),
    recurring: makeRecurringService(db, scope),
    reconcile: makeReconcileService(db, scope),
    templates: makeTemplateService(db, scope),
    analysis: makeAnalysisService(db, scope),
    targets: makeTargetService(db, scope),
    creditLimits: makeCreditLimitService(db, scope),
    loanPrincipals: makeLoanPrincipalService(db, scope),
    backup: makeBackupService(db, scope),
  };
}
