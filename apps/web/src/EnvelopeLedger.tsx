import { useEffect, useState } from "react";
import { type Api, type EnvelopeLedgerRow, type EnvelopeView } from "./api";
import { formatCents } from "./format";

interface Props {
  api: Api;
  envelope: EnvelopeView;
  onBack: () => void;
}

export function EnvelopeLedger({ api, envelope, onBack }: Props) {
  const [rows, setRows] = useState<EnvelopeLedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setRows(await api.getEnvelopeLedger(envelope.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't load ledger — try again.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelope.id]);

  const kindLabel = envelope.kind === "sinking_fund" ? "(sinking fund)" : "(standard)";
  const archivedLabel = envelope.archivedAt !== null ? " (archived)" : "";

  return (
    <main>
      <header>
        <h1>
          {envelope.name} {kindLabel}
          {archivedLabel}
        </h1>
        <p>Balance: {formatCents(envelope.balanceCents)}</p>
        <button type="button" onClick={onBack}>
          ← Dashboard
        </button>
      </header>

      {error ? (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </p>
      ) : null}

      <section aria-labelledby="ledger-heading">
        <h2 id="ledger-heading">Transactions</h2>
        {rows === null && !error ? (
          <p>Loading…</p>
        ) : rows !== null && rows.length === 0 ? (
          <p>No transactions in this envelope yet.</p>
        ) : rows !== null ? (
          <table aria-labelledby="ledger-heading">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Payee / Memo</th>
                <th scope="col">Account</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.allocationId}>
                  <td>{r.occurredOn}</td>
                  <td>
                    {r.payee ??
                      r.memo ??
                      (r.transactionKind === "opening" ? "(opening balance)" : "—")}
                  </td>
                  <td>{r.accountName}</td>
                  <td>
                    {r.amountCents >= 0 ? "+" : "−"}
                    {formatCents(Math.abs(r.amountCents))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
