import { type FormEvent, useEffect, useState } from "react";
import { formatMoney } from "@budgeteer/domain";
import { type Api, type DebtPayoffReport, type LoanAccountPayoff } from "./api";
import { formatBps, formatCents } from "./format";

const NUM: React.CSSProperties = { textAlign: "right" };

/** Owed as text: positive = still owed, negative = overpaid, 0 = paid off. */
const owedText = (owedCents: number): string =>
  owedCents > 0
    ? formatCents(owedCents)
    : owedCents < 0
      ? `${formatCents(-owedCents)} overpaid`
      : "$0.00 (paid off)";

/** Payoff as text (never colour/bar alone): "—" when no original principal. */
const payoffText = (bps: number | null): string =>
  bps === null ? "— (set an original principal)" : formatBps(bps);

/**
 * Analysis — debt payoff (FEAT-014b). For every loan account: how much of its original principal has
 * been paid down (payoff = 1 − owed/original), a month-by-month payoff trend, and a portfolio roll-up
 * across loans with an original principal. "Owed" is the derived balance (a loan carries debt as a
 * negative balance ⇒ owed = −balance); the original principal is set/cleared inline. The math is a
 * pure domain function fed by the analysis read; this view is thin. a11y: real tables with captions +
 * `scope`'d headers; every ratio is shown as TEXT (percent, "overpaid", "paid off"), never colour or a
 * bar alone (the consolidated contrast pass is #16). Sibling of the Credit view (#14a).
 */
export function PayoffView({ api, onBack }: { api: Api; onBack: () => void }) {
  const [report, setReport] = useState<DebtPayoffReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    api
      .getDebtPayoff()
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load debt payoff.");
      });
    return () => {
      active = false;
    };
  }, [api, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const onSaveError = (err: unknown) =>
    setError(err instanceof Error ? err.message : "Couldn't save the original principal.");

  async function savePrincipal(accountId: string, amount: string) {
    setError(null);
    await api.setOriginalPrincipal(accountId, amount);
    reload();
  }
  async function clearPrincipal(accountId: string) {
    setError(null);
    await api.clearOriginalPrincipal(accountId);
    reload();
  }

  return (
    <main>
      <header>
        <h1>Analysis — debt payoff</h1>
        <button type="button" onClick={onBack}>
          ← Dashboard
        </button>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <p role="status">Loading…</p>
      ) : report.accounts.length === 0 ? (
        <p>
          No loan accounts yet — add an account with the <em>loan</em> kind, then set its original
          principal to track payoff.
        </p>
      ) : (
        <>
          <dl role="status">
            <div>
              <dt>Total original (across loans with a principal)</dt>
              <dd>{formatCents(report.totalOriginalCents)}</dd>
            </div>
            <div>
              <dt>Total still owed</dt>
              <dd>{formatCents(report.totalOwedCents)}</dd>
            </div>
            <div>
              <dt>Total paid down</dt>
              <dd>{formatCents(report.totalPaidDownCents)}</dd>
            </div>
            <div>
              <dt>Overall payoff</dt>
              <dd>{payoffText(report.payoffBps)}</dd>
            </div>
          </dl>

          <table>
            <caption>
              Each loan account: how much of its original principal is paid down (payoff = 1 − owed
              ÷ original)
            </caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col" style={NUM}>
                  Original principal
                </th>
                <th scope="col" style={NUM}>
                  Owed
                </th>
                <th scope="col" style={NUM}>
                  Paid down
                </th>
                <th scope="col" style={NUM}>
                  Payoff
                </th>
              </tr>
            </thead>
            <tbody>
              {report.accounts.map((a) => (
                <tr key={a.accountId}>
                  <th scope="row">
                    {a.accountName}
                    {a.archived ? " (archived)" : ""}
                  </th>
                  <td style={NUM}>
                    <PrincipalCell
                      key={`${a.accountId}:${a.originalPrincipalCents ?? ""}`}
                      account={a}
                      onSave={(amount) => savePrincipal(a.accountId, amount).catch(onSaveError)}
                      onClear={() => clearPrincipal(a.accountId).catch(onSaveError)}
                    />
                  </td>
                  <td style={NUM}>{owedText(a.owedCents)}</td>
                  <td style={NUM}>
                    {a.paidDownCents === null ? "—" : formatCents(a.paidDownCents)}
                  </td>
                  <td style={NUM}>{payoffText(a.payoffBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.accounts
            .filter((a) => a.trend.length > 0)
            .map((a) => (
              <table key={`trend-${a.accountId}`}>
                <caption>Payoff over time — {a.accountName}</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col" style={NUM}>
                      Owed
                    </th>
                    <th scope="col" style={NUM}>
                      Payoff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.trend.map((p) => (
                    <tr key={p.period}>
                      <th scope="row">{p.period}</th>
                      <td style={NUM}>{owedText(p.owedCents)}</td>
                      <td style={NUM}>{payoffText(p.payoffBps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </>
      )}
    </main>
  );
}

/** Inline original-principal editor for one loan row — set (positive amount) or clear. */
function PrincipalCell({
  account,
  onSave,
  onClear,
}: {
  account: LoanAccountPayoff;
  onSave: (amount: string) => void;
  onClear: () => void;
}) {
  const [value, setValue] = useState(
    account.originalPrincipalCents === null ? "" : formatMoney(account.originalPrincipalCents),
  );
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onSave(value);
  }

  return (
    <form onSubmit={submit} aria-label={`Original principal for ${account.accountName}`}>
      <input
        aria-label={`Original principal for ${account.accountName}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy}>
        Save
      </button>
      {account.originalPrincipalCents !== null ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onClear();
          }}
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
