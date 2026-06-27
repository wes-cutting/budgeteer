import { useEffect, useState } from "react";
import { type Api, type NetWorthReport, type SpendGrain } from "./api";
import { formatCents } from "./format";

const NUM: React.CSSProperties = { textAlign: "right" };

/**
 * Analysis — net worth over time (FEAT-R9). The account-level "how am I doing overall?" picture the
 * analysis area was missing: a derived monthly (or annual) Σ of account balances, decomposed into
 * Assets, Liabilities (credit/loan, carried negative), and Net worth (= assets + liabilities). A
 * grain toggle switches monthly ⇄ annual. Read-only; the signed cents come from the API, formatting
 * is the web display concern (`formatCents`).
 */
export function NetWorthView({ api }: { api: Api }) {
  const [grain, setGrain] = useState<SpendGrain>("month");
  const [report, setReport] = useState<NetWorthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    api
      .getNetWorth(grain)
      .then((r) => {
        if (active) setReport(r);
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
        <h1>Analysis — net worth over time</h1>
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
      {error ? null : report === null ? (
        <p role="status">Loading…</p>
      ) : report.trend.length === 0 ? (
        <p>No account activity to analyze yet — open an account with a starting balance first.</p>
      ) : (
        <>
          <table>
            <caption>Current totals</caption>
            <tbody>
              <tr>
                <th scope="row">Assets</th>
                <td style={NUM}>{formatCents(report.assetsCents)}</td>
              </tr>
              <tr>
                <th scope="row">Liabilities</th>
                <td style={NUM}>{formatCents(report.liabilitiesCents)}</td>
              </tr>
              <tr>
                <th scope="row">Net worth</th>
                <td style={NUM}>{formatCents(report.netCents)}</td>
              </tr>
            </tbody>
          </table>

          <table>
            <caption>
              Net worth over time (assets + liabilities; liabilities are negative = owed)
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col" style={NUM}>
                  Assets
                </th>
                <th scope="col" style={NUM}>
                  Liabilities
                </th>
                <th scope="col" style={NUM}>
                  Net worth
                </th>
              </tr>
            </thead>
            <tbody>
              {report.trend.map((p) => (
                <tr key={p.period}>
                  <th scope="row">{p.period}</th>
                  <td style={NUM}>{formatCents(p.assetsCents)}</td>
                  <td style={NUM}>{formatCents(p.liabilitiesCents)}</td>
                  <td style={NUM}>{formatCents(p.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
