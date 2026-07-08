import styles from "./ProgressBar.module.css";

/** How the fill reads — colour is ALWAYS paired with the caller's adjacent text (and, for `over`,
 *  a hatch shape), so it is never the sole signal (WCAG 1.4.1). */
export type ProgressTone = "accent" | "success" | "caution" | "over";

/**
 * Compact horizontal progress bar (FEAT-UX13) — the inline budget-health encoding (spent-of-target,
 * and any bounded ratio). The `ProgressBar` named in the UX4 seed-and-grow list, added by the slice
 * that first needs it. HAND-ROLLED on the design tokens + CSS — no charting dependency (the richer
 * SVG `Gauge`/`BarChart` remain for the Insights area; this is the row-/panel-scale encoding).
 *
 * A11Y:
 *  - The bar is DECORATIVE (`aria-hidden`). Every call site renders the truthful figure as adjacent
 *    text, so colour and bar length are never the sole signal (1.4.1). It carries no `progressbar`
 *    role, so it adds nothing for a screen reader to double-announce.
 *  - The `over` tone lays a diagonal HATCH over the danger fill — a NON-colour shape signal for
 *    "past 100%" (mirrors the SVG `Gauge`'s over-cap), so over-budget reads without colour.
 *  - Track + fill each clear 3:1 non-text contrast (1.4.11): the track carries a `border-strong`
 *    outline so an empty track is perceivable; fills use the semantic tokens (light + dark).
 *  - NO animation — reduced-motion-safe by construction.
 */
export function ProgressBar({
  ratio,
  tone = "accent",
  className,
}: {
  /** value ÷ max. Clamped to [0, 1] for the fill width; a ratio > 1 forces the `over` treatment. */
  ratio: number;
  tone?: ProgressTone;
  className?: string;
}) {
  const over = tone === "over" || ratio > 1;
  const fillTone: ProgressTone = over ? "over" : tone;
  const pct = over ? 100 : Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div aria-hidden="true" className={[styles.track, className].filter(Boolean).join(" ")}>
      <div className={[styles.fill, styles[fillTone]].join(" ")} style={{ width: `${pct}%` }} />
    </div>
  );
}
