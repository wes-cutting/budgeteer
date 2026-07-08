import { type FormEvent, useEffect, useState } from "react";
import { formatMoney } from "@budgeteer/domain";
import { type Api, type BudgetVsActualReport, type BudgetVsActualRow } from "./api";
import { formatCents } from "./format";
import { BarChart, Button, Field, Input, ProgressBar, Skeleton, type ProgressTone } from "./ui";
import styles from "./Insights.module.css";

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

/** Budget-health tone for a spent-of-target ratio (UX13): over budget → over; nearing the target
 *  (>=80%) → caution; otherwise on track. Colour is only ever a reinforcement — the row always shows
 *  the figures as text. */
function budgetTone(spentCents: number, targetCents: number, remainingCents: number): ProgressTone {
  if (remainingCents < 0) return "over";
  if (targetCents > 0 && spentCents / targetCents >= 0.8) return "caution";
  return "accent";
}

/** The spent-of-target bar for a row/total, or an em dash when there's no target to measure against. */
function BudgetProgress({
  targetCents,
  spentCents,
  remainingCents,
}: {
  targetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
}) {
  if (targetCents === null || targetCents <= 0 || remainingCents === null) return <>—</>;
  return (
    <ProgressBar
      ratio={spentCents / targetCents}
      tone={budgetTone(spentCents, targetCents, remainingCents)}
    />
  );
}

/**
 * Insights — budget vs. actual (FEAT-012, charted in UX8). For a chosen month, each envelope's
 * monthly **target** (the budget) vs. its **actual spend** (outflow only), with the remaining budget
 * (`target − spent`, positive = under). Targets are set/cleared inline. UX8 adds a hand-rolled
 * accessible grouped bar chart (ADR-0007) — Target vs. Spent per envelope, the second series hatched
 * so the pair reads without colour — above the editing table, which is the data-table fallback.
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

  const budgetTable =
    report === null ? null : (
      <table className={styles.table}>
        <caption>
          Monthly target vs. actual spend for {month} (remaining = target − spent; negative = over
          budget)
        </caption>
        <thead>
          <tr>
            <th scope="col">Envelope</th>
            <th scope="col" className={styles.numeric}>
              Monthly target
            </th>
            <th scope="col" className={styles.numeric}>
              Spent
            </th>
            <th scope="col" className={styles.numeric}>
              Remaining
            </th>
            <th scope="col" className={styles.progressCell}>
              Spent of target
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
              <td className={styles.numeric}>
                <TargetCell
                  key={`${row.envelopeId}:${row.targetCents ?? ""}`}
                  row={row}
                  onSave={(amount) => saveTarget(row.envelopeId, amount).catch(onSaveError)}
                  onClear={() => clearTarget(row.envelopeId).catch(onSaveError)}
                />
              </td>
              <td className={styles.numeric}>{formatCents(row.spentCents)}</td>
              <td
                className={
                  row.remainingCents !== null && row.remainingCents < 0
                    ? `${styles.numeric} ${styles.overText}`
                    : styles.numeric
                }
              >
                {row.remainingCents === null ? "—" : formatCents(row.remainingCents)}
              </td>
              <td className={styles.progressCell}>
                <BudgetProgress
                  targetCents={row.targetCents}
                  spentCents={row.spentCents}
                  remainingCents={row.remainingCents}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className={styles.numeric}>{formatCents(report.totalTargetCents)}</td>
            <td className={styles.numeric}>{formatCents(report.totalSpentCents)}</td>
            <td
              className={
                report.totalRemainingCents < 0
                  ? `${styles.numeric} ${styles.overText}`
                  : styles.numeric
              }
            >
              {formatCents(report.totalRemainingCents)}
            </td>
            <td className={styles.progressCell}>
              <BudgetProgress
                targetCents={report.totalTargetCents}
                spentCents={report.totalSpentCents}
                remainingCents={report.totalRemainingCents}
              />
            </td>
          </tr>
        </tfoot>
      </table>
    );

  // Only envelopes with a target set make a meaningful budget-vs-actual bar pair.
  const budgeted = report?.rows.filter((r) => r.targetCents !== null) ?? [];

  return (
    <main>
      <header>
        <h1>Insights — budget vs. actual</h1>
      </header>

      <div className={styles.controls}>
        <Field label="Month" htmlFor="budget-month">
          <Input
            id="budget-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            max={thisMonth()}
          />
        </Field>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <Skeleton />
      ) : report.rows.length === 0 ? (
        <p>No envelopes to budget yet — add envelopes, then set a monthly target on each.</p>
      ) : budgeted.length === 0 ? (
        budgetTable
      ) : (
        <BarChart
          caption={`Budget vs. actual — ${month}`}
          summary={
            `Monthly target vs. spent for ${month} across ${budgeted.length} budgeted ` +
            `${budgeted.length === 1 ? "envelope" : "envelopes"}: target ${formatCents(report.totalTargetCents)}, ` +
            `spent ${formatCents(report.totalSpentCents)}, remaining ${formatCents(report.totalRemainingCents)}.`
          }
          categories={budgeted.map((r) => r.envelopeName + (r.archived ? " (archived)" : ""))}
          series={[
            {
              label: "Target",
              token: "var(--chart-1)",
              values: budgeted.map((r) => r.targetCents ?? 0),
            },
            {
              label: "Spent",
              token: "var(--chart-2)",
              pattern: true,
              values: budgeted.map((r) => r.spentCents),
            },
          ]}
          formatY={formatCents}
          table={budgetTable}
        />
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
    <form className={styles.editor} onSubmit={submit} aria-label={`Target for ${row.envelopeName}`}>
      <Input
        aria-label={`Monthly target for ${row.envelopeName}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
      />
      <Button type="submit" variant="accent" disabled={busy}>
        Save
      </Button>
      {row.targetCents !== null ? (
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
