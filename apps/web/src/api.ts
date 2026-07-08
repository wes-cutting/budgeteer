// API client. The response/view types are the server's own definitions, imported types-only from
// `@budgeteer/api/contract` (EH12) and re-exported so the UI keeps importing them from "./api".
// The client trusts the typed contract on reads — no runtime re-validation (see
// docs/06_API_CONTRACT.md, "Client boundary"). Only the client-side input shapes live here:
// form-shaped (dollar-string amounts), with omitted dates filled by this adapter (EH8).

import type {
  AccountKind,
  AccountView,
  BudgetVsActualReport,
  CashFlowForecast,
  CreditLimitView,
  CreditUtilizationReport,
  DebtPayoffReport,
  EnvelopeKind,
  EnvelopeLedgerRow,
  EnvelopeSpendRollup,
  EnvelopeTargetView,
  EnvelopeTransferView,
  EnvelopeView,
  LoanPrincipalView,
  NetWorthRollup,
  PostDueResult,
  ReconciliationView,
  RecurringFrequency,
  RecurringView,
  SpendGrain,
  TemplateView,
  TransactionView,
  TransferView,
} from "@budgeteer/api/contract";
import { localMonthRange, localToday } from "./dates";

export type * from "@budgeteer/api/contract";

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  occurredOn?: string; // defaults to the user's local today (EH8) — filled by the adapter
  memo?: string;
}

export interface CreateEnvelopeTransferInput {
  fromEnvelopeId: string;
  toEnvelopeId: string;
  amount: string;
  occurredOn?: string; // defaults to the user's local today (EH8) — filled by the adapter
  memo?: string;
}

/** One row the user is allocating: a positive magnitude string for an envelope. A `refund` row
 *  points OPPOSITE the transaction's direction (FEAT-008). */
export interface AllocationDraft {
  envelopeId: string;
  amount: string;
  refund?: boolean;
}

export interface CreateTransactionInput {
  kind: "deposit" | "withdrawal";
  amount: string;
  occurredOn?: string; // defaults to the user's local today (EH8) — filled by the adapter
  payee?: string;
  memo?: string;
  allocations: AllocationDraft[];
}

export interface CreateRecurringInput {
  accountId: string;
  kind: "deposit" | "withdrawal";
  amount: string;
  payee?: string;
  memo?: string;
  frequency: RecurringFrequency;
  anchorOn: string;
  lines: AllocationDraft[];
}

export interface CreateReconciliationInput {
  statementBalance: string;
  reconciledOn?: string; // defaults to the user's local today (EH8) — filled by the adapter
}

// --- Analysis: cash-flow forecast (FEAT-013) ---

export interface ForecastOptions {
  horizonDays?: number; // default 90, capped [7,365]
  includeExpected?: boolean; // default true
}

/** All calendar dates are caller-local (EH8): the server never derives a user-facing date, so
 *  `httpApi` sends every date/month parameter explicitly, deriving omitted ones from the
 *  user's local clock via `dates.ts`. */

/** Thrown on a non-2xx response, carrying the server's user-facing message. */
export class ApiError extends Error {}

export interface Api {
  listAccounts(): Promise<AccountView[]>;
  createAccount(input: {
    name: string;
    kind: AccountKind;
    startingBalance: string;
  }): Promise<AccountView>;
  renameAccount(id: string, name: string): Promise<AccountView>;
  archiveAccount(id: string): Promise<AccountView>;
  unarchiveAccount(id: string): Promise<AccountView>;
  listEnvelopes(): Promise<EnvelopeView[]>;
  createEnvelope(input: { name: string; kind: EnvelopeKind }): Promise<EnvelopeView>;
  archiveEnvelope(id: string): Promise<EnvelopeView>;
  unarchiveEnvelope(id: string): Promise<EnvelopeView>;
  listTransactions(
    accountId: string,
    range?: { from?: string; to?: string },
  ): Promise<TransactionView[]>;
  createTransaction(accountId: string, input: CreateTransactionInput): Promise<TransactionView>;
  deleteTransaction(id: string): Promise<void>;
  deleteTransfer(id: string): Promise<void>;
  createTransfer(input: CreateTransferInput): Promise<TransferView>;
  createEnvelopeTransfer(input: CreateEnvelopeTransferInput): Promise<EnvelopeTransferView>;
  setAllocations(transactionId: string, allocations: AllocationDraft[]): Promise<TransactionView>;
  listNeedsAllocation(): Promise<TransactionView[]>;
  listTemplates(): Promise<TemplateView[]>;
  createTemplate(input: { name: string; lines: AllocationDraft[] }): Promise<TemplateView>;
  updateTemplate(
    id: string,
    input: { name: string; lines: AllocationDraft[] },
  ): Promise<TemplateView>;
  deleteTemplate(id: string): Promise<void>;
  listRecurring(): Promise<RecurringView[]>;
  createRecurring(input: CreateRecurringInput): Promise<RecurringView>;
  deleteRecurring(id: string): Promise<void>;
  postDueRecurring(): Promise<PostDueResult>;
  listReconciliations(accountId: string): Promise<ReconciliationView[]>;
  createReconciliation(
    accountId: string,
    input: CreateReconciliationInput,
  ): Promise<ReconciliationView>;
  getEnvelopeLedger(envelopeId: string): Promise<EnvelopeLedgerRow[]>;
  getEnvelopeSpend(grain: SpendGrain): Promise<EnvelopeSpendRollup>;
  getBudgetVsActual(month: string): Promise<BudgetVsActualReport>;
  getCashFlowForecast(accountId: string, opts?: ForecastOptions): Promise<CashFlowForecast>;
  setEnvelopeTarget(envelopeId: string, amount: string): Promise<EnvelopeTargetView>;
  clearEnvelopeTarget(envelopeId: string): Promise<void>;
  getCreditUtilization(): Promise<CreditUtilizationReport>;
  setCreditLimit(accountId: string, amount: string): Promise<CreditLimitView>;
  clearCreditLimit(accountId: string): Promise<void>;
  getDebtPayoff(): Promise<DebtPayoffReport>;
  setOriginalPrincipal(accountId: string, amount: string): Promise<LoanPrincipalView>;
  clearOriginalPrincipal(accountId: string): Promise<void>;
  getNetWorth(grain: SpendGrain): Promise<NetWorthRollup>;
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

/** Direct URL for the backup download — an anchor href, not a fetch call (no CORS needed). */
export const exportUrl = `${BASE}/export`;

function errorMessage(data: unknown): string | undefined {
  if (typeof data === "object" && data !== null) {
    const err = (data as { error?: { message?: unknown } }).error;
    if (err && typeof err.message === "string") return err.message;
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare a JSON content-type when there's actually a body — a bodyless request
  // (GET/DELETE) with `content-type: application/json` trips servers' empty-body checks.
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body !== undefined && headers["content-type"] === undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(errorMessage(data) ?? "Request failed.");
  return data as T;
}

export const httpApi: Api = {
  async listAccounts() {
    return (await request<{ accounts: AccountView[] }>("/accounts")).accounts;
  },
  async createAccount(input) {
    // The opening-balance row lands on the user's local today (EH8).
    return (
      await request<{ account: AccountView }>("/accounts", {
        method: "POST",
        body: JSON.stringify({ ...input, openedOn: localToday() }),
      })
    ).account;
  },
  async renameAccount(id, name) {
    return (
      await request<{ account: AccountView }>(`/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      })
    ).account;
  },
  async archiveAccount(id) {
    return (await request<{ account: AccountView }>(`/accounts/${id}/archive`, { method: "POST" }))
      .account;
  },
  async unarchiveAccount(id) {
    return (
      await request<{ account: AccountView }>(`/accounts/${id}/unarchive`, { method: "POST" })
    ).account;
  },
  async listEnvelopes() {
    return (await request<{ envelopes: EnvelopeView[] }>("/envelopes")).envelopes;
  },
  async createEnvelope(input) {
    return (
      await request<{ envelope: EnvelopeView }>("/envelopes", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).envelope;
  },
  async archiveEnvelope(id) {
    return (
      await request<{ envelope: EnvelopeView }>(`/envelopes/${id}/archive`, { method: "POST" })
    ).envelope;
  },
  async unarchiveEnvelope(id) {
    return (
      await request<{ envelope: EnvelopeView }>(`/envelopes/${id}/unarchive`, { method: "POST" })
    ).envelope;
  },
  async listTransactions(accountId, range) {
    // from/to are required by the API (EH8); an omitted half falls back to the user's
    // local current month — the register's default window (R8), derived client-side.
    const def = localMonthRange();
    const qs = new URLSearchParams({
      from: range?.from ?? def.from,
      to: range?.to ?? def.to,
    });
    return (
      await request<{ transactions: TransactionView[] }>(
        `/accounts/${accountId}/transactions?${qs.toString()}`,
      )
    ).transactions;
  },
  async createTransaction(accountId, input) {
    return (
      await request<{ transaction: TransactionView }>(`/accounts/${accountId}/transactions`, {
        method: "POST",
        body: JSON.stringify({ ...input, occurredOn: input.occurredOn ?? localToday() }),
      })
    ).transaction;
  },
  async deleteTransaction(id) {
    await request<unknown>(`/transactions/${id}`, { method: "DELETE" });
  },
  async deleteTransfer(id) {
    await request<unknown>(`/transfers/${id}`, { method: "DELETE" });
  },
  async createTransfer(input) {
    return (
      await request<{ transfer: TransferView }>("/transfers", {
        method: "POST",
        body: JSON.stringify({ ...input, occurredOn: input.occurredOn ?? localToday() }),
      })
    ).transfer;
  },
  async createEnvelopeTransfer(input) {
    return (
      await request<{ envelopeTransfer: EnvelopeTransferView }>("/envelope-transfers", {
        method: "POST",
        body: JSON.stringify({ ...input, occurredOn: input.occurredOn ?? localToday() }),
      })
    ).envelopeTransfer;
  },
  async setAllocations(transactionId, allocations) {
    return (
      await request<{ transaction: TransactionView }>(
        `/transactions/${transactionId}/allocations`,
        { method: "PUT", body: JSON.stringify({ allocations }) },
      )
    ).transaction;
  },
  async listNeedsAllocation() {
    return (await request<{ transactions: TransactionView[] }>("/transactions/needs-allocation"))
      .transactions;
  },
  async listTemplates() {
    return (await request<{ templates: TemplateView[] }>("/templates")).templates;
  },
  async createTemplate(input) {
    return (
      await request<{ template: TemplateView }>("/templates", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).template;
  },
  async updateTemplate(id, input) {
    return (
      await request<{ template: TemplateView }>(`/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      })
    ).template;
  },
  async deleteTemplate(id) {
    await request<unknown>(`/templates/${id}`, { method: "DELETE" });
  },
  async listRecurring() {
    // Due-ness is relative to the user's local today (EH8).
    return (await request<{ recurring: RecurringView[] }>(`/recurring?today=${localToday()}`))
      .recurring;
  },
  async createRecurring(input) {
    return (
      await request<{ recurring: RecurringView }>("/recurring", {
        method: "POST",
        body: JSON.stringify({ ...input, today: localToday() }),
      })
    ).recurring;
  },
  async deleteRecurring(id) {
    await request<unknown>(`/recurring/${id}`, { method: "DELETE" });
  },
  async postDueRecurring() {
    return (
      await request<{ result: PostDueResult }>("/recurring/post-due", {
        method: "POST",
        body: JSON.stringify({ today: localToday() }),
      })
    ).result;
  },
  async listReconciliations(accountId) {
    return (
      await request<{ reconciliations: ReconciliationView[] }>(
        `/accounts/${accountId}/reconciliations`,
      )
    ).reconciliations;
  },
  async createReconciliation(accountId, input) {
    return (
      await request<{ reconciliation: ReconciliationView }>(
        `/accounts/${accountId}/reconciliations`,
        {
          method: "POST",
          body: JSON.stringify({ ...input, reconciledOn: input.reconciledOn ?? localToday() }),
        },
      )
    ).reconciliation;
  },
  async getEnvelopeLedger(envelopeId) {
    return (await request<{ rows: EnvelopeLedgerRow[] }>(`/envelopes/${envelopeId}/ledger`)).rows;
  },
  async getEnvelopeSpend(grain) {
    return (
      await request<{ rollup: EnvelopeSpendRollup }>(`/analysis/envelope-spend?grain=${grain}`)
    ).rollup;
  },
  async getBudgetVsActual(month) {
    return (
      await request<{ report: BudgetVsActualReport }>(`/analysis/budget-vs-actual?month=${month}`)
    ).report;
  },
  async getCashFlowForecast(accountId, opts) {
    // The projection's day zero is the user's local today (EH8).
    const params = new URLSearchParams({ accountId, today: localToday() });
    if (opts?.horizonDays !== undefined) params.set("horizonDays", String(opts.horizonDays));
    if (opts?.includeExpected !== undefined)
      params.set("includeExpected", String(opts.includeExpected));
    return (await request<{ forecast: CashFlowForecast }>(`/analysis/cash-flow-forecast?${params}`))
      .forecast;
  },
  async setEnvelopeTarget(envelopeId, amount) {
    return (
      await request<{ target: EnvelopeTargetView }>(`/envelopes/${envelopeId}/target`, {
        method: "PUT",
        body: JSON.stringify({ amount }),
      })
    ).target;
  },
  async clearEnvelopeTarget(envelopeId) {
    await request<unknown>(`/envelopes/${envelopeId}/target`, { method: "DELETE" });
  },
  async getCreditUtilization() {
    return (await request<{ report: CreditUtilizationReport }>("/analysis/credit-utilization"))
      .report;
  },
  async setCreditLimit(accountId, amount) {
    return (
      await request<{ creditLimit: CreditLimitView }>(`/accounts/${accountId}/credit-limit`, {
        method: "PUT",
        body: JSON.stringify({ amount }),
      })
    ).creditLimit;
  },
  async clearCreditLimit(accountId) {
    await request<unknown>(`/accounts/${accountId}/credit-limit`, { method: "DELETE" });
  },
  async getDebtPayoff() {
    return (await request<{ report: DebtPayoffReport }>("/analysis/debt-payoff")).report;
  },
  async setOriginalPrincipal(accountId, amount) {
    return (
      await request<{ loanPrincipal: LoanPrincipalView }>(
        `/accounts/${accountId}/original-principal`,
        { method: "PUT", body: JSON.stringify({ amount }) },
      )
    ).loanPrincipal;
  },
  async clearOriginalPrincipal(accountId) {
    await request<unknown>(`/accounts/${accountId}/original-principal`, { method: "DELETE" });
  },
  async getNetWorth(grain) {
    return (await request<{ report: NetWorthRollup }>(`/analysis/net-worth?grain=${grain}`)).report;
  },
};
