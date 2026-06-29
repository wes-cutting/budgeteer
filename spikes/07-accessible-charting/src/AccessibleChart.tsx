import { useId, useState } from "react";
import styles from "./AccessibleChart.module.css";

/**
 * SPIKE-07 — the accessible-charting pattern being validated for ADR-0007.
 *
 * One real chart: net-worth-over-time (mirrors the V1 `getNetWorth` shape — assets / liabilities /
 * net, signed cents, ascending periods). HAND-ROLLED SVG, zero charting dependency.
 *
 * The a11y contract this proves:
 *  - the SVG is `role="img"` with a one-line `aria-label` SUMMARY; its decorative innards are
 *    `aria-hidden` (a screen reader hears the summary, not 200 tspans).
 *  - a real `<table>` fallback carries the EXACT figures — the keyboard + screen-reader path
 *    (native table semantics, no ARIA needed). It is the source of truth, toggled by a button
 *    (the chart's one interactive control; keyboard-operable; `aria-expanded`/`aria-controls`).
 *  - COLOR IS NEVER THE SOLE SIGNAL: each series is also distinguished by a dash pattern, a
 *    distinct end marker, and a DIRECT TEXT LABEL at the end of its line.
 *  - strokes use the `--chart-*` tokens, tuned >= 3:1 vs the surface in light AND dark (1.4.11).
 *  - NO opacity animation on text (would trip the contrast gate) — the disclosure uses height.
 */

export interface NetWorthPoint {
  period: string; // "YYYY-MM"
  assetsCents: number;
  liabilitiesCents: number; // <= 0 (owed)
  netCents: number;
}

const SERIES = [
  { key: "assetsCents", label: "Assets", token: "var(--chart-1)", dash: "0", marker: "circle" },
  {
    key: "liabilitiesCents",
    label: "Liabilities",
    token: "var(--chart-2)",
    dash: "6 4",
    marker: "square",
  },
  { key: "netCents", label: "Net worth", token: "var(--chart-3)", dash: "2 3", marker: "triangle" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const fmt = (cents: number) =>
  (cents < 0 ? "-" : "") +
  "$" +
  Math.abs(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const shortMonth = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
};

/** Decorative end-marker per series (color reinforced by SHAPE). */
function Marker({ kind, cx, cy, fill }: { kind: string; cx: number; cy: number; fill: string }) {
  if (kind === "square")
    return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill={fill} />;
  if (kind === "triangle")
    return <polygon points={`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`} fill={fill} />;
  return <circle cx={cx} cy={cy} r={4.5} fill={fill} />;
}

export function AccessibleChart({ data, title }: { data: NetWorthPoint[]; title: string }) {
  const [showTable, setShowTable] = useState(true);
  const tableId = useId();

  // geometry
  const W = 640;
  const H = 320;
  const pad = { top: 16, right: 96, bottom: 36, left: 64 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const all = data.flatMap((d) => [d.assetsCents, d.liabilitiesCents, d.netCents]);
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const y = (c: number) => pad.top + innerH - (innerH * (c - min)) / (max - min || 1);

  // axis ticks (5 evenly spaced)
  const ticks = Array.from({ length: 5 }, (_, k) => min + ((max - min) * k) / 4);

  const first = data[0];
  const last = data[data.length - 1];
  const summary =
    first && last
      ? `Net worth over ${data.length} months, ${shortMonth(first.period)} to ${shortMonth(last.period)}: ` +
        `assets ${fmt(first.assetsCents)} to ${fmt(last.assetsCents)}, ` +
        `liabilities ${fmt(first.liabilitiesCents)} to ${fmt(last.liabilitiesCents)}, ` +
        `net worth ${fmt(first.netCents)} to ${fmt(last.netCents)}.`
      : "No data.";

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{title}</figcaption>

      {/* role="img" + summary label = the screen-reader headline; innards hidden from the a11y tree */}
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        preserveAspectRatio="xMidYMid meet"
      >
        <g aria-hidden="true">
          {/* grid + y ticks */}
          {ticks.map((t, k) => (
            <g key={k}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={pad.left - 8} y={y(t) + 4} className={styles.axis} textAnchor="end">
                {fmt(t)}
              </text>
            </g>
          ))}
          {/* zero baseline emphasized */}
          <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} className={styles.zero} />

          {/* x labels */}
          {data.map((d, i) => (
            <text key={d.period} x={x(i)} y={H - pad.bottom + 20} className={styles.axis} textAnchor="middle">
              {shortMonth(d.period)}
            </text>
          ))}

          {/* one polyline per series + end marker + DIRECT label */}
          {SERIES.map((s) => {
            const pts = data.map((d, i) => `${x(i)},${y(d[s.key as SeriesKey])}`).join(" ");
            const lastVal = last ? last[s.key as SeriesKey] : 0;
            const lx = x(data.length - 1);
            const ly = y(lastVal);
            return (
              <g key={s.key}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.token}
                  strokeWidth={2.5}
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                />
                <Marker kind={s.marker} cx={lx} cy={ly} fill={s.token} />
                <text x={lx + 10} y={ly + 4} className={styles.serieslabel} fill={s.token}>
                  {s.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? "Hide data table" : "Show data table"}
      </button>

      {/* the accessible source of truth: a real table (keyboard + SR via native semantics) */}
      <div id={tableId} hidden={!showTable}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>{title} — figures</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {SERIES.map((s) => (
                <th key={s.key} scope="col" className={styles.num}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.period}>
                <th scope="row">{d.period}</th>
                <td className={styles.num}>{fmt(d.assetsCents)}</td>
                <td className={styles.num}>{fmt(d.liabilitiesCents)}</td>
                <td className={styles.num}>{fmt(d.netCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
