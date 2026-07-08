// The client-facing read contract (EH12): every response/view type the HTTP routes serialize,
// re-exported from the modules that define them so the server's own definitions are the single
// source of truth. This module is TYPES-ONLY — it must never export a value, so the web bundle
// can `import type` from `@budgeteer/api/contract` without pulling in any server runtime
// (fastify/kysely/pg). The web-zone boundary lint enforces that the import stays type-only.
//
// Write/input shapes are deliberately NOT here: the wire inputs are defined by the routes' zod
// schemas (the validation boundary), and the client keeps its own form-shaped input types.
// The client-boundary stance (typed contract, no client-side re-validation of reads) is recorded
// in docs/06_API_CONTRACT.md.

export type { AccountView } from "./services/accountService";
export type { EnvelopeView, EnvelopeLedgerRow } from "./services/envelopeService";
export type { AllocationView, TransactionView } from "./services/transactionService";
export type { TransferLegView, TransferView } from "./services/transferService";
export type {
  EnvelopeTransferEndpointView,
  EnvelopeTransferView,
} from "./services/envelopeTransferService";
export type { TemplateLineView, TemplateView } from "./services/templateService";
export type { RecurringLineView, RecurringView, PostDueResult } from "./services/recurringService";
export type { ReconciliationView } from "./services/reconcileService";
export type { EnvelopeTargetView } from "./services/targetService";
export type { CreditLimitView } from "./services/creditLimitService";
export type { LoanPrincipalView } from "./services/loanPrincipalService";
export type {
  SpendGrain,
  EnvelopeSpendRow,
  EnvelopeSpendRollup,
  BudgetVsActualRow,
  BudgetVsActualReport,
  CashFlowForecast,
  NetWorthRollup,
  PayPeriodPlanView,
} from "./services/analysisService";

// Domain-defined wire types (the analysis services serialize these verbatim), re-exported so the
// client has one import surface for everything that crosses the HTTP boundary.
export type {
  AccountKind,
  EnvelopeKind,
  RecurringFrequency,
  ForecastPoint,
  UtilizationPoint,
  CreditAccountUtilization,
  CreditUtilizationReport,
  PayoffPoint,
  LoanAccountPayoff,
  DebtPayoffReport,
  NetWorthPoint,
  PayPeriodBill,
  PayPeriodBucket,
  PayPeriodPlan,
} from "@budgeteer/domain";
