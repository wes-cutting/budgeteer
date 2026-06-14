// API client + the view types the UI depends on (mirrors apps/api responses; shared types are
// a future refinement once the domain package ships a build — see docs/06_API_CONTRACT.md).

export type AccountKind = "checking" | "savings" | "credit" | "cash" | "other";
export type EnvelopeKind = "standard" | "sinking_fund";

export interface AccountView {
  id: string;
  name: string;
  kind: AccountKind;
  balanceCents: number;
  archivedAt: string | null;
}

export interface EnvelopeView {
  id: string;
  name: string;
  kind: EnvelopeKind;
  balanceCents: number;
  archivedAt: string | null;
}

export interface AllocationView {
  id: string;
  envelopeId: string;
  envelopeName: string;
  amountCents: number;
}

export interface TransactionView {
  id: string;
  accountId: string;
  accountName: string;
  kind: "opening" | "normal";
  amountCents: number;
  occurredOn: string;
  payee: string | null;
  memo: string | null;
  allocations: AllocationView[];
  allocatedCents: number;
  unallocatedCents: number;
}

/** One row the user is allocating: a positive magnitude string for an envelope. */
export interface AllocationDraft {
  envelopeId: string;
  amount: string;
}

export interface CreateTransactionInput {
  kind: "deposit" | "withdrawal";
  amount: string;
  occurredOn?: string;
  payee?: string;
  memo?: string;
  allocations: AllocationDraft[];
}

export interface TemplateLineView {
  id: string;
  envelopeId: string;
  envelopeName: string;
  amountCents: number;
}

export interface TemplateView {
  id: string;
  name: string;
  lines: TemplateLineView[];
}

/** Thrown on a non-2xx response, carrying the server's user-facing message. */
export class ApiError extends Error {}

export interface Api {
  listAccounts(): Promise<AccountView[]>;
  createAccount(input: {
    name: string;
    kind: AccountKind;
    startingBalance: string;
  }): Promise<AccountView>;
  listEnvelopes(): Promise<EnvelopeView[]>;
  createEnvelope(input: { name: string; kind: EnvelopeKind }): Promise<EnvelopeView>;
  listTransactions(accountId: string): Promise<TransactionView[]>;
  createTransaction(accountId: string, input: CreateTransactionInput): Promise<TransactionView>;
  setAllocations(transactionId: string, allocations: AllocationDraft[]): Promise<TransactionView>;
  listNeedsAllocation(): Promise<TransactionView[]>;
  listTemplates(): Promise<TemplateView[]>;
  createTemplate(input: { name: string; lines: AllocationDraft[] }): Promise<TemplateView>;
  updateTemplate(
    id: string,
    input: { name: string; lines: AllocationDraft[] },
  ): Promise<TemplateView>;
  deleteTemplate(id: string): Promise<void>;
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

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
    return (
      await request<{ account: AccountView }>("/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      })
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
  async listTransactions(accountId) {
    return (
      await request<{ transactions: TransactionView[] }>(`/accounts/${accountId}/transactions`)
    ).transactions;
  },
  async createTransaction(accountId, input) {
    return (
      await request<{ transaction: TransactionView }>(`/accounts/${accountId}/transactions`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).transaction;
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
};
