import { describe, expect, test } from "vitest";
import {
  type ActualSpendThisMonth,
  type ForecastRule,
  type ForecastTarget,
  cashFlowForecast,
  clampHorizon,
  expectedSpendEvents,
  runningBalance,
  scheduledEvents,
} from "../src/index";

// A realistic single-account fixture (Checking), today = 2026-06-16, derived balance $1,240.00.
const TODAY = "2026-06-16";
const START = 124000;

const rules: ForecastRule[] = [
  {
    label: "Paycheck",
    direction: "deposit",
    amountCents: 210000,
    frequency: "biweekly",
    anchorOn: "2026-06-05",
    nextOccurrenceOn: "2026-06-19",
    lines: [],
  },
  {
    label: "Rent",
    direction: "withdrawal",
    amountCents: 150000,
    frequency: "monthly",
    anchorOn: "2026-07-01",
    nextOccurrenceOn: "2026-07-01",
    lines: [{ envelopeId: "rent", magnitudeCents: 150000, refund: false }],
  },
  {
    label: "Electric",
    direction: "withdrawal",
    amountCents: 12000,
    frequency: "monthly",
    anchorOn: "2026-06-20",
    nextOccurrenceOn: "2026-06-20",
    lines: [{ envelopeId: "utilities", magnitudeCents: 12000, refund: false }],
  },
];

const targets: ForecastTarget[] = [
  { envelopeId: "groceries", monthlyTargetCents: 40000 },
  { envelopeId: "dining", monthlyTargetCents: 15000 },
  { envelopeId: "utilities", monthlyTargetCents: 12000 }, // fully scheduled (Electric)
  { envelopeId: "rent", monthlyTargetCents: 150000 }, // fully scheduled (Rent)
];

// June actuals already posted (already in START): Groceries $360, Dining $40, Rent $1,500 (06-01).
const actualJune: ActualSpendThisMonth = new Map([
  ["groceries", 36000],
  ["dining", 4000],
  ["rent", 150000],
  ["utilities", 0],
]);

describe("cash-flow forecast (FEAT-013)", () => {
  test("scheduled events: the recurring engine, fed a FUTURE horizon, yields only strictly-future occurrences", () => {
    const ev = scheduledEvents(rules, TODAY, "2026-09-14"); // 90 days out
    expect(ev.filter((e) => e.label === "Paycheck").map((e) => e.date)).toEqual([
      "2026-06-19",
      "2026-07-03",
      "2026-07-17",
      "2026-07-31",
      "2026-08-14",
      "2026-08-28",
      "2026-09-11",
    ]);
    expect(ev.filter((e) => e.label === "Rent").length).toBe(3); // 07-01, 08-01, 09-01
    expect(ev.filter((e) => e.label === "Electric").length).toBe(3); // 06-20, 07-20, 08-20 (09-20 clipped)
    expect(ev.every((e) => e.date > TODAY)).toBe(true);
  });

  test("event-stepping core: ending balance, min + date, first-negative, conservative same-day order", () => {
    const f = runningBalance(100000, "2026-06-16", "2026-06-30", 14, false, [
      { date: "2026-06-20", deltaCents: +50000, kind: "scheduled", label: "in" },
      { date: "2026-06-20", deltaCents: -130000, kind: "scheduled", label: "out" }, // same day → out first
      { date: "2026-06-25", deltaCents: +90000, kind: "scheduled", label: "in" },
    ]);
    expect(f.points[0]?.balanceCents).toBe(-30000); // outflow applied before inflow (conservative)
    expect(f.endingBalanceCents).toBe(110000);
    expect(f.minBalanceCents).toBe(-30000);
    expect(f.minBalanceDate).toBe("2026-06-20");
    expect(f.firstNegativeDate).toBe("2026-06-20");
  });

  test("ANTI-DOUBLE-COUNT: fully-scheduled / already-spent envelopes contribute ZERO expected spend", () => {
    const ev = expectedSpendEvents(targets, rules, actualJune, TODAY, "2026-09-14", "monthStart");
    const byMonth = new Map(ev.map((e) => [e.date.slice(0, 7), -e.deltaCents]));
    // June: Groceries 40000-36000 + Dining 15000-4000 + Utilities(12000-12000 sched)=0 + Rent(150000-150000 actual)=0
    expect(byMonth.get("2026-06")).toBe(15000);
    // July/Aug (full): Groceries 40000 + Dining 15000 + Utilities(−sched 0) + Rent(−sched 0) = 55000
    expect(byMonth.get("2026-07")).toBe(55000);
    expect(byMonth.get("2026-08")).toBe(55000);
    // Sept partial (09-01..09-14 of 30): Electric (09-20) outside window → Utilities leaks; ×14/30.
    expect(byMonth.get("2026-09")).toBe(Math.trunc((67000 * 14) / 30));
  });

  test("the netted residual excludes EXACTLY the scheduled bills (no double-counting)", () => {
    const fullTargetsPerMonth = targets.reduce((s, t) => s + t.monthlyTargetCents, 0); // 217000
    const ev = expectedSpendEvents(targets, rules, actualJune, TODAY, "2026-09-14", "monthStart");
    const july = -(ev.find((e) => e.date.startsWith("2026-07"))?.deltaCents ?? 0);
    expect(fullTargetsPerMonth).toBe(217000);
    expect(july).toBe(55000); // groceries + dining only
    expect(fullTargetsPerMonth - july).toBe(162000); // = scheduled rent $1500 + electric $120
  });

  test("expected spend only LOWERS the balance — scheduled-only is the firm floor", () => {
    const base = { horizonDays: 90, strategy: "evenDaily" as const };
    const scheduledOnly = cashFlowForecast(START, TODAY, rules, targets, actualJune, {
      ...base,
      includeExpected: false,
    });
    const withExpected = cashFlowForecast(START, TODAY, rules, targets, actualJune, {
      ...base,
      includeExpected: true,
    });
    expect(withExpected.endingBalanceCents).toBeLessThan(scheduledOnly.endingBalanceCents);
    expect(withExpected.minBalanceCents).toBeLessThanOrEqual(scheduledOnly.minBalanceCents);
    expect(scheduledOnly.firstNegativeDate).toBeNull(); // paychecks dominate
    expect(scheduledOnly.includeExpected).toBe(false);
  });

  test("even-daily spread is integer-cent EXACT — Σ portions == the prorated residual", () => {
    const odd: ForecastTarget[] = [{ envelopeId: "groceries", monthlyTargetCents: 10001 }];
    // today in June → July is a FUTURE partial month (proration applies); window 07-01..07-16 = 16/31.
    const ev = expectedSpendEvents(odd, [], new Map(), "2026-06-30", "2026-07-16", "evenDaily");
    const total = ev.reduce((s, e) => s + -e.deltaCents, 0);
    expect(total).toBe(Math.trunc((10001 * 16) / 31)); // 5161, no drift
    expect(ev.every((e) => Number.isInteger(e.deltaCents))).toBe(true);
  });

  test("a thin account dipping below zero before payday is flagged with the exact date", () => {
    const thin: ForecastRule[] = [
      {
        label: "Paycheck",
        direction: "deposit",
        amountCents: 210000,
        frequency: "biweekly",
        anchorOn: "2026-07-03",
        nextOccurrenceOn: "2026-07-03",
        lines: [],
      },
      {
        label: "Rent",
        direction: "withdrawal",
        amountCents: 150000,
        frequency: "monthly",
        anchorOn: "2026-07-01",
        nextOccurrenceOn: "2026-07-01",
        lines: [{ envelopeId: "rent", magnitudeCents: 150000, refund: false }],
      },
    ];
    // 19-day horizon → 06-16..07-05 captures rent 07-01 then paycheck 07-03.
    const f = cashFlowForecast(20000, TODAY, thin, [], new Map(), {
      horizonDays: 19,
      includeExpected: false,
    });
    expect(f.firstNegativeDate).toBe("2026-07-01");
    expect(f.minBalanceCents).toBe(-130000);
    expect(f.endingBalanceCents).toBe(80000);
  });

  test("an account already negative today reports first-negative = the start date", () => {
    const f = cashFlowForecast(-5000, TODAY, [], [], new Map(), {
      horizonDays: 30,
      includeExpected: true,
    });
    expect(f.firstNegativeDate).toBe(TODAY);
    expect(f.minBalanceCents).toBe(-5000);
    expect(f.points).toEqual([]); // no rules, no targets → flat
  });

  test("horizon is clamped to [7, 365]", () => {
    expect(clampHorizon(1)).toBe(7);
    expect(clampHorizon(90)).toBe(90);
    expect(clampHorizon(9999)).toBe(365);
    expect(clampHorizon(30.9)).toBe(30);
  });
});
