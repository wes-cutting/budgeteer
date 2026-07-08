import { useEffect, useState } from "react";
import { type BurndownStatus, assessBurndown } from "@budgeteer/domain";
import { type Api, type BudgetVsActualReport, type BudgetVsActualRow } from "./api";
import { formatBps, formatCents } from "./format";
import { Field, Gauge, Input, Select, Skeleton } from "./ui";
import styles from "./Insights.module.css";

/**
 * Insights — budget burn-down (FEAT-UX11): WITHIN-MONTH pace vs. target. For a chosen month and scope
 * (all budgeted envelopes, or one), how far through the budget you are (spent ÷ target) against how
 * far through the month you are (elapsed calendar days) — so you can see if you're on track BEFORE
 * month-end, not just after (that's what budget-vs-actual shows).
 *
 * READ DECISION: composes the EXISTING `getBudgetVsActual(month)` read — ONE call (no fan-out, no new
 * endpoint). That read already returns every envelope's target + spent AND the month, which is exactly
 * the burn-down's numerator (spent-so-far) and denominator (target). The only thing it can't give —
 * "expected pace so far" — is pure calendar math from the month string + today, computed client-side
 * via the domain's `assessBurndown` (pace/pure-core), so nothing new is needed server-side. This is
 * lighter than UX10's per-month fan-out, extending the R4/R5/UX9/UX10 compose-existing-reads precedent.
 *
 * CHART: reuses the existing `Gauge` shape AS-IS — the ratio is spent ÷ target, and the threshold
 * marker is repurposed as "where you'd expect to be today" (the elapsed-time pace). The over/under/
 * on-track state is carried by POSITION (fill end vs. the pace marker) + TEXT (the value label, a
 * verdict line, the summary) and by the exact figures in the table — never by colour alone (ADR-0007).
 */

const thisMonth = (): string => new Date().toISOString().slice(0, 7);
const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Percent from a 0..1 fraction, e.g. 0.8 → "80.0%" (reuses the bps formatter). */
const formatPct = (fraction: number): string => formatBps(Math.round(fraction * 10000));

const ALL = "all";

/** Short verdict text per status — the a11y-critical non-colour signal (also drives the aria-label). */
const STATUS_SHORT: Record<BurndownStatus, string> = {
  "over-budget": "over budget",
  "over-pace": "over pace",
  "on-track": "on track",
};

/** One-sentence verdict shown next to the gauge — colour never carries the state alone. */
const STATUS_TEXT: Record<BurndownStatus, string> = {
  "over-budget": "Over budget — you've already spent more than the whole month's target.",
  "over-pace": "Over pace — you're spending faster than the month is elapsing.",
  "on-track": "On track — you're spending at or below the expected pace.",
};

/** A budgeted envelope row (target set) — the only rows a burn-down can pace. */
const isBudgeted = (r: BudgetVsActualRow): boolean => r.targetCents !== null && r.targetCents > 0;

export function BudgetBurndownView({ api }: { api: Api }) {
  const [month, setMonth] = useState<string>(thisMonth);
  const [scopeId, setScopeId] = useState<string>(ALL);
  const [report, setReport] = useState<BudgetVsActualReport | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [api, month]);

  // Changing the month resets the scope to "all" so the picker can never point at an envelope that
  // isn't budgeted in the newly loaded month.
  function changeMonth(next: string) {
    setScopeId(ALL);
    setMonth(next);
  }

  const budgeted = report?.rows.filter(isBudgeted) ?? [];
  const today = todayISO();

  // Household aggregate over the budgeted rows (the "all" scope), computed once.
  const allTargetCents = budgeted.reduce((s, r) => s + (r.targetCents ?? 0), 0);
  const allSpentCents = budgeted.reduce((s, r) => s + r.spentCents, 0);

  // The selected scope's target + spent + display name: "all" uses the aggregate; otherwise it's one
  // row (falling back to "all" if that envelope isn't budgeted this month).
  const selected = budgeted.find((r) => r.envelopeId === scopeId);
  const scopeTargetCents = selected?.targetCents ?? allTargetCents;
  const scopeSpentCents = selected?.spentCents ?? allSpentCents;
  const scopeName = selected
    ? selected.envelopeName + (selected.archived ? " (archived)" : "")
    : "All budgeted envelopes";

  const assessment =
    budgeted.length === 0
      ? null
      : assessBurndown(
          { month, targetCents: scopeTargetCents, spentCents: scopeSpentCents },
          today,
        );
  const allAssessment =
    budgeted.length === 0
      ? null
      : assessBurndown({ month, targetCents: allTargetCents, spentCents: allSpentCents }, today);

  const burndownTable =
    report === null ? null : (
      <table className={styles.table}>
        <caption>
          Budget burn-down for {month} — spent vs. target and pace, with{" "}
          {formatPct(assessment?.elapsedFraction ?? 0)} of the month elapsed
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
              % of budget
            </th>
            <th scope="col">Pace</th>
          </tr>
        </thead>
        <tbody>
          {budgeted.map((r) => {
            const a = assessBurndown(
              { month, targetCents: r.targetCents ?? 0, spentCents: r.spentCents },
              today,
            );
            return (
              <tr key={r.envelopeId}>
                <th scope="row">
                  {r.envelopeName}
                  {r.archived ? " (archived)" : ""}
                </th>
                <td className={styles.numeric}>{formatCents(r.targetCents ?? 0)}</td>
                <td className={styles.numeric}>{formatCents(r.spentCents)}</td>
                <td className={styles.numeric}>{formatPct(a.consumedFraction)}</td>
                <td>{STATUS_SHORT[a.status]}</td>
              </tr>
            );
          })}
        </tbody>
        {budgeted.length > 1 && allAssessment !== null ? (
          <tfoot>
            <tr>
              <th scope="row">All budgeted envelopes</th>
              <td className={styles.numeric}>{formatCents(allTargetCents)}</td>
              <td className={styles.numeric}>{formatCents(allSpentCents)}</td>
              <td className={styles.numeric}>{formatPct(allAssessment.consumedFraction)}</td>
              <td>{STATUS_SHORT[allAssessment.status]}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    );

  return (
    <main>
      <header>
        <h1>Insights — budget burn-down</h1>
      </header>

      <div className={styles.controls}>
        <Field label="Month" htmlFor="burndown-month">
          <Input
            id="burndown-month"
            type="month"
            value={month}
            onChange={(e) => changeMonth(e.target.value)}
            max={thisMonth()}
          />
        </Field>
        {budgeted.length > 0 ? (
          <Field label="Scope" htmlFor="burndown-scope">
            <Select
              id="burndown-scope"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            >
              <option value={ALL}>All budgeted envelopes</option>
              {budgeted.map((r) => (
                <option key={r.envelopeId} value={r.envelopeId}>
                  {r.envelopeName}
                  {r.archived ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <Skeleton />
      ) : assessment === null ? (
        <p>
          No budgets set for {month} — set a monthly target in{" "}
          <strong>Insights — budget vs. actual</strong>, then come back to pace it.
        </p>
      ) : (
        <>
          <p className={styles.verdict}>{STATUS_TEXT[assessment.status]}</p>
          <Gauge
            caption={`Budget burn-down — ${scopeName}, ${month}`}
            summary={
              `${scopeName}: ${formatPct(assessment.consumedFraction)} of the ` +
              `${formatCents(scopeTargetCents)} budget spent (${formatCents(scopeSpentCents)}) with ` +
              `${formatPct(assessment.elapsedFraction)} of ${month} elapsed — ${STATUS_SHORT[assessment.status]}.`
            }
            ratio={assessment.consumedFraction}
            valueLabel={
              `${formatPct(assessment.consumedFraction)} of budget` +
              (assessment.status === "over-budget" ? " — over budget" : "")
            }
            token="var(--chart-1)"
            threshold={{
              at: assessment.elapsedFraction,
              label: `Pace today (${formatPct(assessment.elapsedFraction)})`,
            }}
            table={burndownTable}
          />
        </>
      )}
    </main>
  );
}
