import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  type ActualSpendThisMonth,
  type RecurringRule,
  type Target,
  buildForecast,
  expectedSpendEvents,
  runningBalance,
  scheduledEvents,
} from "./forecast.js";

// ---- A realistic single-account fixture (Checking), today = 2026-06-16 ---------------------
const TODAY = "2026-06-16";
const START = 124000; // $1,240.00 derived current balance

const rules: RecurringRule[] = [
  // Paycheck: biweekly deposit $2,100, next 2026-06-19 → 06-19, 07-03, 07-17, 07-31, 08-14, ...
  { label: "Paycheck", direction: "deposit", amountCents: 210000, frequency: "biweekly", anchorOn: "2026-06-05", nextOccurrenceOn: "2026-06-19", lines: [] },
  // Rent: monthly withdrawal $1,500, next 2026-07-01 → 07-01, 08-01, 09-01. Fully budgeted.
  { label: "Rent", direction: "withdrawal", amountCents: 150000, frequency: "monthly", anchorOn: "2026-07-01", nextOccurrenceOn: "2026-07-01", lines: [{ envelopeId: "rent", magnitudeCents: 150000, refund: false }] },
  // Electric: monthly withdrawal $120, next 2026-06-20 → 06-20, 07-20, 08-20, (09-20 outside 90d).
  { label: "Electric", direction: "withdrawal", amountCents: 12000, frequency: "monthly", anchorOn: "2026-06-20", nextOccurrenceOn: "2026-06-20", lines: [{ envelopeId: "utilities", magnitudeCents: 12000, refund: false }] },
];

const targets: Target[] = [
  { envelopeId: "groceries", monthlyTargetCents: 40000 }, // discretionary
  { envelopeId: "dining", monthlyTargetCents: 15000 }, // discretionary
  { envelopeId: "utilities", monthlyTargetCents: 12000 }, // fully scheduled (Electric)
  { envelopeId: "rent", monthlyTargetCents: 150000 }, // fully scheduled (Rent)
];

// What budget-vs-actual would report for June so far (already in START): Groceries $360, Dining
// $40, Rent $1,500 (paid 06-01), Utilities $0 (Electric is 06-20, future).
const actualJune: ActualSpendThisMonth = new Map([
  ["groceries", 36000],
  ["dining", 4000],
  ["rent", 150000],
  ["utilities", 0],
]);

test("1. recurring engine, fed a FUTURE horizon, enumerates only strictly-future occurrences", () => {
  const ev = scheduledEvents(rules, TODAY, "2026-09-14"); // 90 days out
  const pay = ev.filter((e) => e.label === "Paycheck").map((e) => e.date);
  assert.deepEqual(pay, ["2026-06-19", "2026-07-03", "2026-07-17", "2026-07-31", "2026-08-14", "2026-08-28", "2026-09-11"]);
  assert.equal(ev.filter((e) => e.label === "Rent").length, 3); // 07-01, 08-01, 09-01
  assert.equal(ev.filter((e) => e.label === "Electric").length, 3); // 06-20, 07-20, 08-20 (09-20 clipped)
  assert.ok(ev.every((e) => e.date > TODAY), "no occurrence on/before today leaks in");
});

test("2. event-stepping core: running balance, ending balance, min, and conservative same-day order", () => {
  const f = runningBalance(100000, "2026-06-16", "2026-06-30", [
    { date: "2026-06-20", deltaCents: +50000, kind: "scheduled", label: "in" },
    { date: "2026-06-20", deltaCents: -130000, kind: "scheduled", label: "out" }, // same day → out first
    { date: "2026-06-25", deltaCents: +90000, kind: "scheduled", label: "in" },
  ]);
  // 100000 → (out first) -130000 = -30000 → +50000 = 20000 → +90000 = 110000
  assert.equal(f.endingBalanceCents, 110000);
  assert.equal(f.points[0]?.balanceCents, -30000); // conservative: outflow applied before inflow
  assert.equal(f.minBalanceCents, -30000);
  assert.equal(f.minBalanceDate, "2026-06-20");
  assert.equal(f.firstNegativeDate, "2026-06-20");
});

test("3. GOLD — fully-scheduled / already-spent envelopes contribute ZERO expected spend (anti-double-count)", () => {
  const ev = expectedSpendEvents(targets, rules, actualJune, TODAY, "2026-09-14", "monthStart");
  // One lump per month (monthStart strategy). Months touched: 2026-06, -07, -08, -09.
  const byMonth = new Map(ev.map((e) => [e.date.slice(0, 7), -e.deltaCents]));
  // June: Groceries 40000-36000=4000; Dining 15000-4000=11000; Utilities 12000-0-12000(sched 06-20)=0;
  //       Rent 150000-150000(actual)-0=0  → 15000
  assert.equal(byMonth.get("2026-06"), 15000);
  // July (full month, no actuals): Groceries 40000; Dining 15000; Utilities 12000-12000(sched 07-20)=0;
  //      Rent 150000-150000(sched 07-01)=0  → 55000
  assert.equal(byMonth.get("2026-07"), 55000);
  assert.equal(byMonth.get("2026-08"), 55000);
  // Sept is a PARTIAL future month (09-01..09-14 of 30 days). Electric (09-20) is OUTSIDE the window,
  // so Utilities leaks as residual; everything prorated by 14/30.
  // Groceries 40000 + Dining 15000 + Utilities 12000 + Rent(150000-150000 sched 09-01=0) = 67000; ×14/30 = 31266
  assert.equal(byMonth.get("2026-09"), Math.trunc((67000 * 14) / 30));
});

test("4. naive 'add the whole targets' would double-count vs. the netted residual", () => {
  const fullTargetsPerMonth = targets.reduce((s, t) => s + t.monthlyTargetCents, 0); // 217000 = $2,170
  const ev = expectedSpendEvents(targets, rules, actualJune, TODAY, "2026-09-14", "monthStart");
  const julyResidual = -(ev.find((e) => e.date.startsWith("2026-07"))?.deltaCents ?? 0);
  assert.equal(fullTargetsPerMonth, 217000);
  // The netted residual is discretionary-only ($400 groceries + $150 dining):
  assert.equal(julyResidual, 55000);
  // The exact amount NOT double-counted = the fully-scheduled $1,500 rent + $120 electric:
  assert.equal(fullTargetsPerMonth - julyResidual, 162000);
});

test("5. expected spend only LOWERS the balance — scheduled-only is the firm floor, +expected the softer line", () => {
  const opts = { horizonDays: 90, strategy: "evenDaily" as const };
  const scheduledOnly = buildForecast(START, TODAY, rules, targets, actualJune, { ...opts, includeExpected: false });
  const withExpected = buildForecast(START, TODAY, rules, targets, actualJune, { ...opts, includeExpected: true });
  assert.ok(withExpected.endingBalanceCents < scheduledOnly.endingBalanceCents, "expected spend reduces ending balance");
  assert.ok(withExpected.minBalanceCents <= scheduledOnly.minBalanceCents, "expected spend can only lower the min");
  // Scheduled-only is healthy (paychecks dominate), never negative.
  assert.equal(scheduledOnly.firstNegativeDate, null);
});

test("6. even-daily spreading is integer-cent EXACT (no drift) — Σ portions == prorated residual", () => {
  // Odd residual that doesn't divide evenly across the days, to catch rounding drift. today is in
  // June so July is a FUTURE partial month (proration applies); window 07-01..07-16 = 16 of 31 days.
  const odd: Target[] = [{ envelopeId: "groceries", monthlyTargetCents: 10001 }];
  const noActual: ActualSpendThisMonth = new Map();
  const ev = expectedSpendEvents(odd, [], noActual, "2026-06-30", "2026-07-16", "evenDaily");
  const total = ev.reduce((s, e) => s + -e.deltaCents, 0);
  assert.equal(total, Math.trunc((10001 * 16) / 31)); // 5161 — exact, no drift
  assert.ok(ev.every((e) => Number.isInteger(e.deltaCents)), "every portion is integer cents");
});

test("7. a thin account that dips below zero before payday is detected with the exact date", () => {
  const thin: RecurringRule[] = [
    { label: "Paycheck", direction: "deposit", amountCents: 210000, frequency: "biweekly", anchorOn: "2026-07-03", nextOccurrenceOn: "2026-07-03", lines: [] },
    { label: "Rent", direction: "withdrawal", amountCents: 150000, frequency: "monthly", anchorOn: "2026-07-01", nextOccurrenceOn: "2026-07-01", lines: [{ envelopeId: "rent", magnitudeCents: 150000, refund: false }] },
  ];
  // 19-day horizon → 06-16..07-05 captures rent 07-01 then paycheck 07-03 (next pay 07-17 is out).
  const f = buildForecast(20000, TODAY, thin, [], new Map(), { horizonDays: 19, includeExpected: false });
  // $200 → rent 07-01 −$1,500 = −$1,300 (negative!) → paycheck 07-03 +$2,100 = $800
  assert.equal(f.firstNegativeDate, "2026-07-01");
  assert.equal(f.minBalanceCents, -130000);
  assert.equal(f.endingBalanceCents, 80000);
});

// ---- print the headline forecast so the report can paste real numbers ----------------------
test("0. (print) the headline 90-day forecast, scheduled + expected (evenDaily)", () => {
  const f = buildForecast(START, TODAY, rules, targets, actualJune, { horizonDays: 90, includeExpected: true, strategy: "evenDaily" });
  const usd = (c: number): string => (c < 0 ? "-" : "") + "$" + (Math.abs(c) / 100).toFixed(2);
  console.log(`\nForecast: Checking, ${f.startDate} → ${f.endDate}, start ${usd(f.startingBalanceCents)}`);
  console.log(`  ending ${usd(f.endingBalanceCents)} · min ${usd(f.minBalanceCents)} on ${f.minBalanceDate} · first-negative ${f.firstNegativeDate ?? "never"}`);
  console.log(`  ${f.points.length} events (scheduled + daily expected-spend)`);
  for (const p of f.points.filter((p) => p.kind === "scheduled")) {
    console.log(`    ${p.date}  ${usd(p.deltaCents).padStart(11)}  → ${usd(p.balanceCents).padStart(11)}  ${p.label}`);
  }
  assert.ok(true);
});
