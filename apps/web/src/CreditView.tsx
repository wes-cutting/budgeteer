import { type FormEvent, useEffect, useState } from "react";
import { formatMoney } from "@budgeteer/domain";
import { type Api, type CreditAccountUtilization, type CreditUtilizationReport } from "./api";
import { formatBps, formatCents } from "./format";

const NUM: React.CSSProperties = { textAlign: "right" };

/** Owed as text: positive = debt, negative = a credit balance (overpayment), 0 = settled. */
const owedText = (owedCents: number): string =>
  owedCents > 0
    ? formatCents(owedCents)
    : owedCents < 0
      ? `${formatCents(-owedCents)} credit`
      : "$0.00";

/** Utilization as text (never colour/bar alone): "—" when no limit, "over limit" past 100%. */
const utilizationText = (bps: number | null): string =>
  bps === null ? "— (set a limit)" : `${formatBps(bps)}${bps > 10000 ? " over limit" : ""}`;

/**
 * Analysis — credit utilization (FEAT-014a). For every credit account: how much is owed against its
 * credit limit (owed/limit), a month-by-month utilization trend, and a portfolio roll-up across the
 * accounts that have a limit. "Owed" is the derived balance (a credit balance ≤ 0 = debt); the limit
 * is set/cleared inline. The math is a pure domain function fed by the analysis read; this view is
 * thin. a11y: real tables with captions + `scope`'d headers; every ratio is shown as TEXT (percent,
 * "over limit"), never colour or a bar alone (the consolidated contrast pass is #16).
 */
export function CreditView({ api }: { api: Api }) {
  const [report, setReport] = useState<CreditUtilizationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    api
      .getCreditUtilization()
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((err: unknown) => {
        if (active)
          setError(err instanceof Error ? err.message : "Couldn't load credit utilization.");
      });
    return () => {
      active = false;
    };
  }, [api, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const onSaveError = (err: unknown) =>
    setError(err instanceof Error ? err.message : "Couldn't save the credit limit.");

  async function saveLimit(accountId: string, amount: string) {
    setError(null);
    await api.setCreditLimit(accountId, amount);
    reload();
  }
  async function clearLimit(accountId: string) {
    setError(null);
    await api.clearCreditLimit(accountId);
    reload();
  }

  return (
    <main>
      <header>
        <h1>Analysis — credit utilization</h1>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <p role="status">Loading…</p>
      ) : report.accounts.length === 0 ? (
        <p>
          No credit accounts yet — add an account with the <em>credit</em> kind, then set its credit
          limit to track utilization.
        </p>
      ) : (
        <>
          <dl>
            <div>
              <dt>Total owed (across cards with a limit)</dt>
              <dd>{formatCents(report.totalOwedCents)}</dd>
            </div>
            <div>
              <dt>Total credit limit</dt>
              <dd>{formatCents(report.totalLimitCents)}</dd>
            </div>
            <div>
              <dt>Overall utilization</dt>
              <dd>{utilizationText(report.utilizationBps)}</dd>
            </div>
          </dl>

          <table>
            <caption>
              Each credit account: amount owed vs. its limit (utilization = owed ÷ limit; over 100%
              = over limit)
            </caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col" style={NUM}>
                  Credit limit
                </th>
                <th scope="col" style={NUM}>
                  Owed
                </th>
                <th scope="col" style={NUM}>
                  Available
                </th>
                <th scope="col" style={NUM}>
                  Utilization
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
                    <LimitCell
                      key={`${a.accountId}:${a.limitCents ?? ""}`}
                      account={a}
                      onSave={(amount) => saveLimit(a.accountId, amount).catch(onSaveError)}
                      onClear={() => clearLimit(a.accountId).catch(onSaveError)}
                    />
                  </td>
                  <td style={NUM}>{owedText(a.owedCents)}</td>
                  <td style={NUM}>
                    {a.availableCents === null ? "—" : formatCents(a.availableCents)}
                  </td>
                  <td style={NUM}>{utilizationText(a.utilizationBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.accounts
            .filter((a) => a.trend.length > 0)
            .map((a) => (
              <table key={`trend-${a.accountId}`}>
                <caption>Utilization over time — {a.accountName}</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col" style={NUM}>
                      Owed
                    </th>
                    <th scope="col" style={NUM}>
                      Utilization
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.trend.map((p) => (
                    <tr key={p.period}>
                      <th scope="row">{p.period}</th>
                      <td style={NUM}>{owedText(p.owedCents)}</td>
                      <td style={NUM}>{utilizationText(p.utilizationBps)}</td>
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

/** Inline credit-limit editor for one account row — set (positive amount) or clear. */
function LimitCell({
  account,
  onSave,
  onClear,
}: {
  account: CreditAccountUtilization;
  onSave: (amount: string) => void;
  onClear: () => void;
}) {
  const [value, setValue] = useState(
    account.limitCents === null ? "" : formatMoney(account.limitCents),
  );
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onSave(value);
  }

  return (
    <form onSubmit={submit} aria-label={`Credit limit for ${account.accountName}`}>
      <input
        aria-label={`Credit limit for ${account.accountName}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy}>
        Save
      </button>
      {account.limitCents !== null ? (
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
