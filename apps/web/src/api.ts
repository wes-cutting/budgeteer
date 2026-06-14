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
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
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
};
