# SPIKE-07 (UX2) — accessible charting harness (THROWAWAY)

Disposable harness behind [`docs/spikes/07-accessible-charting.md`](../../docs/spikes/07-accessible-charting.md).
Proves **one real chart** (net-worth-over-time, the V1 `getNetWorth` shape) can be **fully
accessible** — axe WCAG 2.2 AA + keyboard + screen reader, with a **data-table fallback**, in
**light AND dark** — **hand-rolled in SVG**, within the 120 KB gz app budget. **Not the V1 app**;
findings live in the spike report + [`ADR-0007`](../../docs/adr/ADR-0007-accessible-charting.md).
Discard once `UX8` absorbs the pattern.

## What it shows

- `src/AccessibleChart.tsx` — the validated pattern: SVG `role="img"` + summary `aria-label`,
  `aria-hidden` decorative innards, a real `<table>` fallback (the SR/keyboard source of truth)
  behind a disclosure toggle, and series distinguished by **color + dash + marker shape + direct
  label** (color never the sole signal). `--chart-*` tokens in `src/tokens.css` (copied from the app).
- `src/measure/*` — React-externalized bundle probes: the hand-rolled chart vs Recharts.

## Run it

```sh
npm install                 # local deps (gitignored)
npm run typecheck           # strict tsc, exit 0

# axe gate (real Chromium, light+dark × table shown/hidden) — reuses the repo-root Playwright + axe
npm run build               # full harness build (dist/)
npm run preview &           # serve on :4317
npm run axe                 # 0 violations across all four targets

# bundle cost (gzip, React externalized = marginal cost added to the app bundle)
MEASURE_ENTRY=src/measure/handrolled-entry.tsx MEASURE_OUT=dist-handrolled vite build --config vite.recharts.config.ts   # ~1.94 KB gz
MEASURE_ENTRY=src/measure/recharts-entry.tsx   MEASURE_OUT=dist-recharts   vite build --config vite.recharts.config.ts   # ~129 KB gz
```

## Result

0 axe violations (light/dark × table-shown/hidden); hand-rolled **1.94 KB gz** vs Recharts
**129 KB gz**. → hand-rolled SVG + table fallback (`ADR-0007`).
