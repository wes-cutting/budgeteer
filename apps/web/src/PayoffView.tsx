import { type FormEvent, useEffect, useState } from "react";
import { formatMoney } from "@budgeteer/domain";
import { type Api, type DebtPayoffReport, type LoanAccountPayoff } from "./api";
import { formatBps, formatCents } from "./format";
import { Button, Gauge, Input, Skeleton } from "./ui";
import styles from "./Insights.module.css";

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
 * Insights — debt payoff (FEAT-014b, charted in UX8). For every loan account: how much of its original
 * principal has been paid down (payoff = 1 − owed/original), a month-by-month payoff trend, and a roll-up
 * across loans with an original principal. "Owed" is the derived balance (a loan carries debt as a
 * negative balance ⇒ owed = −balance); the original principal is set/cleared inline. The math is a
 * pure domain function fed by the analysis read; this view is thin. UX8 adds a hand-rolled accessible
 * gauge (ADR-0007) of the portfolio's overall payoff progress; the per-account table is its
 * data-table fallback. Every ratio is also shown as TEXT (percent, "overpaid", "paid off"), never
 * colour or a bar alone. Sibling of the Credit view (#14a).
 */
export function PayoffView({ api }: { api: Api }) {
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

  const accountsTable =
    report === null ? null : (
      <table className={styles.table}>
        <caption>
          Each loan account: how much of its original principal is paid down (payoff = 1 − owed ÷
          original)
        </caption>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" className={styles.numeric}>
              Original principal
            </th>
            <th scope="col" className={styles.numeric}>
              Owed
            </th>
            <th scope="col" className={styles.numeric}>
              Paid down
            </th>
            <th scope="col" className={styles.numeric}>
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
              <td className={styles.numeric}>
                <PrincipalCell
                  key={`${a.accountId}:${a.originalPrincipalCents ?? ""}`}
                  account={a}
                  onSave={(amount) => savePrincipal(a.accountId, amount).catch(onSaveError)}
                  onClear={() => clearPrincipal(a.accountId).catch(onSaveError)}
                />
              </td>
              <td className={styles.numeric}>{owedText(a.owedCents)}</td>
              <td className={styles.numeric}>
                {a.paidDownCents === null ? "—" : formatCents(a.paidDownCents)}
              </td>
              <td className={styles.numeric}>{payoffText(a.payoffBps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <main>
      <header>
        <h2>Insights — debt payoff</h2>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <Skeleton />
      ) : report.accounts.length === 0 ? (
        <p>
          No loan accounts yet — add an account with the <em>loan</em> kind, then set its original
          principal to track payoff.
        </p>
      ) : (
        <>
          <dl className={styles.figures}>
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

          {report.payoffBps === null ? (
            accountsTable
          ) : (
            <Gauge
              caption="Overall debt payoff"
              summary={`Overall debt payoff is ${payoffText(report.payoffBps)} — ${formatCents(report.totalPaidDownCents)} paid down of a ${formatCents(report.totalOriginalCents)} original principal.`}
              ratio={report.payoffBps / 10000}
              valueLabel={payoffText(report.payoffBps)}
              token="var(--chart-3)"
              threshold={{ at: 1, label: "Paid off (100%)" }}
              table={accountsTable}
            />
          )}

          {report.accounts
            .filter((a) => a.trend.length > 0)
            .map((a) => (
              <table key={`trend-${a.accountId}`} className={styles.table}>
                <caption>Payoff over time — {a.accountName}</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col" className={styles.numeric}>
                      Owed
                    </th>
                    <th scope="col" className={styles.numeric}>
                      Payoff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.trend.map((p) => (
                    <tr key={p.period}>
                      <th scope="row">{p.period}</th>
                      <td className={styles.numeric}>{owedText(p.owedCents)}</td>
                      <td className={styles.numeric}>{payoffText(p.payoffBps)}</td>
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
    <form
      className={styles.editor}
      onSubmit={submit}
      aria-label={`Original principal for ${account.accountName}`}
    >
      <Input
        aria-label={`Original principal for ${account.accountName}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
      />
      <Button type="submit" variant="accent" disabled={busy}>
        Save
      </Button>
      {account.originalPrincipalCents !== null ? (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onClear();
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
