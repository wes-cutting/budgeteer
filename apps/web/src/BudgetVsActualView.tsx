import { type FormEvent, useEffect, useState } from "react";
import { formatMoney } from "@budgeteer/domain";
import { type Api, type BudgetVsActualReport, type BudgetVsActualRow } from "./api";
import { formatCents } from "./format";

const NUM: React.CSSProperties = { textAlign: "right" };

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

/**
 * Analysis — budget vs. actual (FEAT-012). For a chosen month, each envelope's monthly **target**
 * (the budget) vs. its **actual spend** (outflow only), with the remaining budget (`target − spent`,
 * positive = under). Targets are set/cleared inline. Read of actuals is generated (analysisService);
 * money formatting is the web display concern (`formatCents`). a11y: real table with caption +
 * `scope`'d headers + totals `<tfoot>`; sign shown as text, never colour alone.
 */
export function BudgetVsActualView({ api }: { api: Api }) {
  const [month, setMonth] = useState<string>(thisMonth);
  const [report, setReport] = useState<BudgetVsActualReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    api
      .getBudgetVsActual(month)
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the budget.");
      });
    return () => {
      active = false;
    };
  }, [api, month, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  async function saveTarget(envelopeId: string, amount: string) {
    setError(null);
    await api.setEnvelopeTarget(envelopeId, amount);
    reload();
  }
  async function clearTarget(envelopeId: string) {
    setError(null);
    await api.clearEnvelopeTarget(envelopeId);
    reload();
  }
  const onSaveError = (err: unknown) =>
    setError(err instanceof Error ? err.message : "Couldn't save the target.");

  return (
    <main>
      <header>
        <h1>Analysis — budget vs. actual</h1>
      </header>

      <label>
        Month{" "}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          max={thisMonth()}
        />
      </label>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <p role="status">Loading…</p>
      ) : report.rows.length === 0 ? (
        <p>No envelopes to budget yet — add envelopes, then set a monthly target on each.</p>
      ) : (
        <table>
          <caption>
            Monthly target vs. actual spend for {month} (remaining = target − spent; negative = over
            budget)
          </caption>
          <thead>
            <tr>
              <th scope="col">Envelope</th>
              <th scope="col" style={NUM}>
                Monthly target
              </th>
              <th scope="col" style={NUM}>
                Spent
              </th>
              <th scope="col" style={NUM}>
                Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.envelopeId}>
                <th scope="row">
                  {row.envelopeName}
                  {row.archived ? " (archived)" : ""}
                </th>
                <td style={NUM}>
                  <TargetCell
                    key={`${row.envelopeId}:${row.targetCents ?? ""}`}
                    row={row}
                    onSave={(amount) => saveTarget(row.envelopeId, amount).catch(onSaveError)}
                    onClear={() => clearTarget(row.envelopeId).catch(onSaveError)}
                  />
                </td>
                <td style={NUM}>{formatCents(row.spentCents)}</td>
                <td style={NUM}>
                  {row.remainingCents === null ? "—" : formatCents(row.remainingCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td style={NUM}>{formatCents(report.totalTargetCents)}</td>
              <td style={NUM}>{formatCents(report.totalSpentCents)}</td>
              <td style={NUM}>{formatCents(report.totalRemainingCents)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </main>
  );
}

/** Inline target editor for one envelope row — set (positive amount) or clear. */
function TargetCell({
  row,
  onSave,
  onClear,
}: {
  row: BudgetVsActualRow;
  onSave: (amount: string) => void;
  onClear: () => void;
}) {
  const [value, setValue] = useState(row.targetCents === null ? "" : formatMoney(row.targetCents));
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onSave(value);
  }

  return (
    <form onSubmit={submit} aria-label={`Target for ${row.envelopeName}`}>
      <input
        aria-label={`Monthly target for ${row.envelopeName}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy}>
        Save
      </button>
      {row.targetCents !== null ? (
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
