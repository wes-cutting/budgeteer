import { type ReactNode, useId, useState } from "react";
import styles from "./Chart.module.css";

/**
 * Accessible charting primitives (FEAT-UX8 · ADR-0007), validated by SPIKE-07.
 *
 * HAND-ROLLED SVG, zero charting dependency. Every chart honours the ADR-0007 a11y contract,
 * centralised here in `ChartFigure` so the six Insights views can't drift from it:
 *
 *  1. the `<svg>` is `role="img"` with a one-line `aria-label` SUMMARY; its decorative innards are
 *     wrapped in an `aria-hidden` group, so a screen reader hears the headline, not hundreds of nodes.
 *  2. a real `<table>` carrying the exact figures is the keyboard + screen-reader source of truth
 *     (native table semantics — no ARIA grid). The view passes its EXISTING analysis table here, so
 *     the migration is literally "add an SVG above the table"; a disclosure toggle hides/shows it
 *     (default shown, so inline editors in those tables stay reachable).
 *  3. COLOUR IS NEVER THE SOLE SIGNAL — series are distinguished by dash pattern + marker shape +
 *     fill pattern + a DIRECT TEXT LABEL, on top of the `--chart-*` colour tokens (themselves >= 3:1).
 *  4. light + dark fall out of the tokens' `prefers-color-scheme` variants.
 *  5. no opacity animation on text (would trip the contrast gate); the disclosure uses `hidden`.
 */

/** A chart series' colour token. Kept as a union so callers can't invent off-palette colours. */
export type ChartToken = "var(--chart-1)" | "var(--chart-2)" | "var(--chart-3)";

type MarkerKind = "circle" | "square" | "triangle" | "diamond";

const W = 640;
const H = 320;
const PAD = { top: 16, right: 116, bottom: 40, left: 76 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

/** The a11y scaffold every chart shape renders through. `children` are the decorative SVG innards. */
function ChartFigure({
  caption,
  summary,
  viewBox = `0 0 ${W} ${H}`,
  defs,
  children,
  table,
}: {
  caption: string;
  summary: string;
  viewBox?: string;
  defs?: ReactNode;
  children: ReactNode;
  table: ReactNode;
}) {
  const [shown, setShown] = useState(true);
  const tableId = useId();
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      <svg
        className={styles.svg}
        viewBox={viewBox}
        role="img"
        aria-label={summary}
        preserveAspectRatio="xMidYMid meet"
      >
        {defs ? <defs>{defs}</defs> : null}
        <g aria-hidden="true">{children}</g>
      </svg>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={shown}
        aria-controls={tableId}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? "Hide data table" : "Show data table"}
      </button>
      <div id={tableId} hidden={!shown}>
        {table}
      </div>
    </figure>
  );
}

/** Decorative end-of-line marker — reinforces each series by SHAPE (not colour alone). */
function Marker({
  kind,
  cx,
  cy,
  fill,
}: {
  kind: MarkerKind;
  cx: number;
  cy: number;
  fill: string;
}) {
  switch (kind) {
    case "square":
      return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill={fill} />;
    case "triangle":
      return (
        <polygon points={`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`} fill={fill} />
      );
    case "diamond":
      return (
        <polygon
          points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`}
          fill={fill}
        />
      );
    default:
      return <circle cx={cx} cy={cy} r={4.5} fill={fill} />;
  }
}

/** Evenly spaced "nice-ish" tick values spanning [min, max] (always includes the ends). */
function ticksOf(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  return Array.from({ length: count + 1 }, (_, k) => min + ((max - min) * k) / count);
}

export interface LineSeries {
  label: string;
  token: ChartToken;
  dash: string; // SVG stroke-dasharray, "0" = solid
  marker: MarkerKind;
  values: number[]; // aligned to `axis`
}

/**
 * Multi-series line over an ordered axis (net worth, cash-flow forecast). Each series carries its own
 * colour token + dash + end marker + a direct label, so it reads without colour. `summary` is the
 * screen-reader headline; `table` is the exact-figures fallback (the view's existing table).
 */
export function LineChart({
  caption,
  summary,
  axis,
  series,
  formatY,
  table,
}: {
  caption: string;
  summary: string;
  axis: string[];
  series: LineSeries[];
  formatY: (n: number) => string;
  table: ReactNode;
}) {
  const all = series.flatMap((s) => s.values);
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const n = axis.length;
  const x = (i: number) => PAD.left + (n <= 1 ? INNER_W / 2 : (INNER_W * i) / (n - 1));
  const y = (v: number) => PAD.top + INNER_H - (INNER_H * (v - min)) / (max - min || 1);
  const ticks = ticksOf(min, max);
  // Thin out x labels so they never collide (show ~ every ceil(n/8)th).
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <ChartFigure caption={caption} summary={summary} table={table}>
      {ticks.map((t, k) => (
        <g key={`t${k}`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
          <text x={PAD.left - 8} y={y(t) + 4} className={styles.axis} textAnchor="end">
            {formatY(t)}
          </text>
        </g>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className={styles.zero} />
      {axis.map((label, i) =>
        i % step === 0 || i === n - 1 ? (
          <text
            key={`x${i}`}
            x={x(i)}
            y={H - PAD.bottom + 22}
            className={styles.axis}
            textAnchor="middle"
          >
            {label}
          </text>
        ) : null,
      )}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        const lastI = s.values.length - 1;
        const lx = x(lastI);
        const ly = y(s.values[lastI] ?? 0);
        return (
          <g key={s.label}>
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
    </ChartFigure>
  );
}

export interface BarSeries {
  label: string;
  token: ChartToken;
  pattern?: boolean; // true = diagonal hatch overlay (a non-colour distinguisher for the 2nd series)
  values: number[]; // aligned to `categories`; may be negative (diverging around zero)
}

/**
 * Categorical bar chart — single diverging series (spend by envelope) or grouped series (budget vs.
 * actual). The 2nd series gets a hatch pattern so the pair reads without colour; a text legend names
 * each series, and a zero baseline anchors negatives. `table` is the exact-figures fallback.
 */
export function BarChart({
  caption,
  summary,
  categories,
  series,
  formatY,
  table,
}: {
  caption: string;
  summary: string;
  categories: string[];
  series: BarSeries[];
  formatY: (n: number) => string;
  table: ReactNode;
}) {
  const hatchId = useId();
  const all = series.flatMap((s) => s.values);
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const y = (v: number) => PAD.top + INNER_H - (INNER_H * (v - min)) / (max - min || 1);
  const ticks = ticksOf(min, max);

  const g = categories.length;
  const groupW = g <= 0 ? INNER_W : INNER_W / g;
  const inner = Math.min(groupW * 0.7, 64);
  const barW = inner / series.length;
  const labelStep = Math.max(1, Math.ceil(g / 8));

  return (
    <ChartFigure
      caption={caption}
      summary={summary}
      table={table}
      defs={
        <pattern
          id={hatchId}
          width={6}
          height={6}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={6} height={6} fill="var(--chart-2)" />
          <line x1={0} y1={0} x2={0} y2={6} stroke="var(--color-bg)" strokeWidth={2.5} />
        </pattern>
      }
    >
      {ticks.map((t, k) => (
        <g key={`t${k}`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
          <text x={PAD.left - 8} y={y(t) + 4} className={styles.axis} textAnchor="end">
            {formatY(t)}
          </text>
        </g>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className={styles.zero} />
      {categories.map((cat, ci) => {
        const gx = PAD.left + groupW * ci + (groupW - inner) / 2;
        return (
          <g key={`c${ci}`}>
            {series.map((s, si) => {
              const v = s.values[ci] ?? 0;
              const top = Math.min(y(v), y(0));
              const height = Math.abs(y(v) - y(0));
              const fill = s.pattern ? `url(#${hatchId})` : s.token;
              return (
                <rect
                  key={s.label}
                  x={gx + barW * si}
                  y={top}
                  width={barW - 2}
                  height={height}
                  fill={fill}
                  stroke={s.token}
                  strokeWidth={s.pattern ? 1 : 0}
                />
              );
            })}
            {ci % labelStep === 0 || ci === g - 1 ? (
              <text
                x={gx + inner / 2}
                y={H - PAD.bottom + 22}
                className={styles.axis}
                textAnchor="middle"
              >
                {cat}
              </text>
            ) : null}
          </g>
        );
      })}
      {/* legend — text + swatch, so the series read without colour */}
      {series.map((s, si) => (
        <g
          key={`l${s.label}`}
          transform={`translate(${W - PAD.right + 12}, ${PAD.top + 14 + si * 20})`}
        >
          <rect
            x={0}
            y={-9}
            width={12}
            height={12}
            fill={s.pattern ? `url(#${hatchId})` : s.token}
            stroke={s.token}
            strokeWidth={s.pattern ? 1 : 0}
          />
          <text x={18} y={1} className={styles.serieslabel} fill={s.token}>
            {s.label}
          </text>
        </g>
      ))}
    </ChartFigure>
  );
}

/**
 * Progress gauge — one ratio (credit utilization, debt payoff) as a horizontal bar with a direct
 * percentage label and an optional threshold marker (e.g. the 100% credit limit). The filled portion
 * clamps to the track, but `valueLabel` carries the truthful figure (incl. "over limit"), so colour
 * and bar length are never the sole signal. `table` holds the per-account detail.
 */
export function Gauge({
  caption,
  summary,
  ratio,
  valueLabel,
  token = "var(--chart-1)",
  threshold,
  table,
}: {
  caption: string;
  summary: string;
  ratio: number; // 0..1 (clamped for the fill); >1 shows the over-threshold marker
  valueLabel: string; // the truthful figure, e.g. "30.0%" or "120.0% over limit"
  token?: ChartToken;
  threshold?: { at: number; label: string }; // fraction of the track, e.g. { at: 1, label: "Limit" }
  table: ReactNode;
}) {
  const GW = 480;
  const GH = 120;
  const pad = { x: 16, top: 44, bottom: 28 };
  const trackW = GW - pad.x * 2;
  const trackH = 22;
  const ty = pad.top;
  const fill = Math.max(0, Math.min(1, ratio)) * trackW;
  const over = ratio > 1;

  return (
    <ChartFigure caption={caption} summary={summary} viewBox={`0 0 ${GW} ${GH}`} table={table}>
      <text x={pad.x} y={26} className={styles.gaugeValue} fill={token}>
        {valueLabel}
      </text>
      <rect x={pad.x} y={ty} width={trackW} height={trackH} rx={4} className={styles.gaugeTrack} />
      <rect x={pad.x} y={ty} width={fill} height={trackH} rx={4} fill={token} />
      {over ? (
        // a hatched cap signalling "past the end" without relying on colour
        <polygon
          points={`${pad.x + trackW},${ty} ${pad.x + trackW + 10},${ty + trackH / 2} ${pad.x + trackW},${ty + trackH}`}
          fill="var(--chart-2)"
        />
      ) : null}
      {threshold ? (
        <g>
          <line
            x1={pad.x + trackW * threshold.at}
            x2={pad.x + trackW * threshold.at}
            y1={ty - 6}
            y2={ty + trackH + 6}
            className={styles.zero}
          />
          <text
            x={pad.x + trackW * threshold.at}
            y={ty + trackH + 22}
            className={styles.axis}
            textAnchor="middle"
          >
            {threshold.label}
          </text>
        </g>
      ) : null}
    </ChartFigure>
  );
}
