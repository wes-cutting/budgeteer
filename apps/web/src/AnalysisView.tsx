import { useEffect, useState } from "react";
import { type Api, type EnvelopeSpendRollup, type SpendGrain } from "./api";
import { formatCents } from "./format";

const NUM: React.CSSProperties = { textAlign: "right" };

/**
 * Analysis — spend by envelope over time (FEAT-011). A generated grid (envelope × period) of net
 * signed allocation flow: `+` = funded, `−` = spent. Replaces the spreadsheet's hand-keyed
 * "18 Monthly" tab. Read-only; a grain toggle switches monthly ⇄ annual. Money formatting is the
 * web display concern (`formatCents`); the signed cents come from the API.
 */
export function AnalysisView({ api, onBack }: { api: Api; onBack: () => void }) {
  const [grain, setGrain] = useState<SpendGrain>("month");
  const [rollup, setRollup] = useState<EnvelopeSpendRollup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRollup(null);
    setError(null);
    api
      .getEnvelopeSpend(grain)
      .then((r) => {
        if (active) setRollup(r);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the analysis.");
      });
    return () => {
      active = false;
    };
  }, [api, grain]);

  return (
    <main>
      <header>
        <h1>Analysis — spend by envelope</h1>
        <button type="button" onClick={onBack}>
          ← Dashboard
        </button>
      </header>

      <div role="radiogroup" aria-label="Grain">
        <label>
          <input
            type="radio"
            name="grain"
            checked={grain === "month"}
            onChange={() => setGrain("month")}
          />{" "}
          Monthly
        </label>
        <label>
          <input
            type="radio"
            name="grain"
            checked={grain === "year"}
            onChange={() => setGrain("year")}
          />{" "}
          Annual
        </label>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {error ? null : rollup === null ? (
        <p role="status">Loading…</p>
      ) : rollup.rows.length === 0 ? (
        <p>No spending to analyze yet — enter and allocate some transactions first.</p>
      ) : (
        <table>
          <caption>Net flow by envelope over time (positive = funded, negative = spent)</caption>
          <thead>
            <tr>
              <th scope="col">Envelope</th>
              {rollup.periods.map((p) => (
                <th key={p} scope="col" style={NUM}>
                  {p}
                </th>
              ))}
              <th scope="col" style={NUM}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rollup.rows.map((row) => (
              <tr key={row.envelopeId}>
                <th scope="row">
                  {row.envelopeName}
                  {row.archived ? " (archived)" : ""}
                </th>
                {row.amounts.map((c, i) => (
                  <td key={`${row.envelopeId}-${i}`} style={NUM}>
                    {formatCents(c)}
                  </td>
                ))}
                <td style={NUM}>{formatCents(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {rollup.periodTotals.map((c, i) => (
                <td key={i} style={NUM}>
                  {formatCents(c)}
                </td>
              ))}
              <td style={NUM}>{formatCents(rollup.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </main>
  );
}
