import { describe, expect, test } from "vitest";
import {
  type ForecastRule,
  type ForecastTarget,
  PAY_PERIOD_LEAD_DAYS,
  type PayPeriodPlan,
  payPeriodPlan,
} from "../src/index";

// FEAT-S7 — the acceptance criteria (§7), each pinned to explicit dates. All fixtures are
// synthetic. The default scenario: today = 2026-07-01, biweekly paychecks starting 2026-07-10.

const NO_ACTUAL = new Map<string, number>();

const paycheck = (over: Partial<ForecastRule> = {}): ForecastRule => ({
  label: "Pay",
  direction: "deposit",
  amountCents: 100000,
  frequency: "biweekly",
  anchorOn: "2026-07-10",
  nextOccurrenceOn: "2026-07-10",
  lines: [],
  ...over,
});

const bill = (
  label: string,
  amountCents: number,
  nextOccurrenceOn: string,
  over: Partial<ForecastRule> = {},
): ForecastRule => ({
  label,
  direction: "withdrawal",
  amountCents,
  frequency: "monthly",
  anchorOn: nextOccurrenceOn,
  nextOccurrenceOn,
  lines: [],
  ...over,
});

const plan = (
  rules: ForecastRule[],
  opts: {
    balance?: number;
    today?: string;
    horizonDays?: number;
    targets?: ForecastTarget[];
    actual?: Map<string, number>;
  } = {},
): PayPeriodPlan =>
  payPeriodPlan(
    opts.balance ?? 500000,
    opts.today ?? "2026-07-01",
    rules,
    opts.targets ?? [],
    opts.actual ?? NO_ACTUAL,
    { horizonDays: opts.horizonDays ?? 35 },
  );

const allBills = (p: PayPeriodPlan): string[] =>
  p.buckets.flatMap((b) => b.bills.map((x) => `${x.dueOn}:${x.label}`));

describe("payPeriodPlan — buckets and assignment (AC1, AC2)", () => {
  test("every bill occurrence lands in exactly one bucket; paychecks appear once, in date order", () => {
    const p = plan([
      paycheck(),
      bill("Rent", 40000, "2026-07-20"),
      bill("Internet", 8000, "2026-08-02"),
    ]);
    // Occurrences in (2026-07-01, 2026-08-05]: Rent 07-20, Internet 08-02 — each exactly once.
    expect(allBills(p).sort()).toEqual(["2026-07-20:Rent", "2026-08-02:Internet"]);
    // Biweekly from 07-10: 07-10, 07-24 (08-07 falls past the 35-day horizon).
    const checks = p.buckets.filter((b) => b.kind === "paycheck");
    expect(checks.map((b) => b.committedOn)).toEqual(["2026-07-10", "2026-07-24"]);
    expect([...p.buckets.map((b) => b.committedOn)]).toEqual(
      [...p.buckets.map((b) => b.committedOn)].sort(),
    );
  });

  test("a bill goes to the LATEST paycheck ≥ leadDays before its due date", () => {
    const p = plan([paycheck(), bill("Water", 5000, "2026-07-22")]);
    // Cutoff 07-15: the 07-10 check qualifies, the 07-24 one doesn't.
    const check = p.buckets.find((b) => b.committedOn === "2026-07-10");
    expect(check?.bills.map((b) => b.label)).toEqual(["Water"]);
    expect(p.leadDays).toBe(PAY_PERIOD_LEAD_DAYS);
  });

  test("a bill due sooner than leadDays after the first paycheck comes from the balance (bucket zero)", () => {
    const p = plan([paycheck(), bill("Storage", 5000, "2026-07-12")]);
    const zero = p.buckets[0];
    expect(zero?.kind).toBe("balance");
    expect(zero?.committedOn).toBe("2026-07-01"); // committed at today
    expect(zero?.incomeCents).toBe(0);
    expect(zero?.bills.map((b) => b.label)).toEqual(["Storage"]);
  });

  test("the balance bucket is omitted when nothing draws on it", () => {
    const p = plan([paycheck(), bill("Water", 5000, "2026-07-22")]);
    expect(p.buckets.every((b) => b.kind === "paycheck")).toBe(true);
  });

  test("capacity awareness: a bill that no longer fits the latest feasible check moves earlier (SPIKE-10)", () => {
    // Both bills due 08-01 (cutoff 07-25): checks 07-10 and 07-24 are feasible, income $1,000.
    // Larger first: A ($800) → 07-24; B ($700) doesn't fit there → 07-10.
    const p = plan([
      paycheck(),
      bill("Big-A", 80000, "2026-08-01"),
      bill("Big-B", 70000, "2026-08-01"),
    ]);
    const jul10 = p.buckets.find((b) => b.committedOn === "2026-07-10");
    const jul24 = p.buckets.find((b) => b.committedOn === "2026-07-24");
    expect(jul24?.bills.map((b) => b.label)).toEqual(["Big-A"]);
    expect(jul10?.bills.map((b) => b.label)).toEqual(["Big-B"]);
    expect(jul10?.overCommitted).toBe(false);
    expect(jul24?.overCommitted).toBe(false);
  });

  test("overflow: when every feasible check is full the latest one takes it and is marked over-committed", () => {
    // One feasible check (income $500) vs $700 of bills due 08-01.
    const p = plan(
      [
        paycheck({ amountCents: 50000, frequency: "monthly", anchorOn: "2026-07-10" }),
        bill("Big-A", 40000, "2026-08-01"),
        bill("Big-B", 30000, "2026-08-01"),
      ],
      { horizonDays: 32, balance: 0 },
    );
    const check = p.buckets.find((b) => b.kind === "paycheck");
    expect(check?.bills.map((b) => b.label)).toEqual(["Big-A", "Big-B"]);
    expect(check?.overCommitted).toBe(true);
    expect(check?.totalCents).toBe(70000);
  });

  test("deposits are never assigned as bills; zero income sends every bill to the balance bucket", () => {
    const p = plan([bill("Rent", 40000, "2026-07-20")]);
    expect(p.buckets).toHaveLength(1);
    expect(p.buckets[0]?.kind).toBe("balance");
    expect(p.buckets[0]?.bills.map((b) => b.label)).toEqual(["Rent"]);
  });
});

describe("payPeriodPlan — planned spending (AC3, AC4)", () => {
  test("a three-paycheck month gets three buckets and splits the month's residual three ways", () => {
    // Biweekly anchored 08-01: checks 08-01, 08-15, 08-29 — all in August.
    const p = plan([paycheck({ anchorOn: "2026-08-01", nextOccurrenceOn: "2026-08-01" })], {
      today: "2026-07-31",
      horizonDays: 31,
      targets: [{ envelopeId: "e1", monthlyTargetCents: 30001 }],
    });
    const checks = p.buckets.filter((b) => b.kind === "paycheck");
    expect(checks.map((b) => b.committedOn)).toEqual(["2026-08-01", "2026-08-15", "2026-08-29"]);
    const shares = checks.map((b) => b.plannedSpendCents);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(30001); // exact split (parts differ ≤ 1¢)
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  test("netting: a fully-scheduled envelope contributes zero planned spending (SPIKE-05)", () => {
    const p = plan(
      [
        paycheck(),
        bill("Rent", 20000, "2026-07-20", {
          lines: [{ envelopeId: "e1", magnitudeCents: 20000, refund: false }],
        }),
      ],
      // Horizon pinned inside July so no clipped-August residual muddies the assertion.
      { targets: [{ envelopeId: "e1", monthlyTargetCents: 20000 }], horizonDays: 30 },
    );
    expect(p.buckets.every((b) => b.plannedSpendCents === 0)).toBe(true);
  });

  test("bucket total = bills + planned-spending share (AC4)", () => {
    const p = plan([paycheck(), bill("Water", 5000, "2026-07-22")], {
      targets: [{ envelopeId: "e1", monthlyTargetCents: 10000 }],
    });
    for (const b of p.buckets) {
      expect(b.totalCents).toBe(
        b.bills.reduce((sum, x) => sum + x.amountCents, 0) + b.plannedSpendCents,
      );
    }
  });

  test("a month's residual with no paycheck in it draws on the balance bucket", () => {
    // Monthly paycheck on the 10th; horizon clips before the August check, but August days
    // (08-01 … 08-05) still carry prorated expected spend — chargeable only to the balance.
    const p = plan([paycheck({ frequency: "monthly", anchorOn: "2026-07-10" })], {
      targets: [{ envelopeId: "e1", monthlyTargetCents: 31000 }],
      horizonDays: 35,
    });
    const zero = p.buckets.find((b) => b.kind === "balance");
    expect(zero).toBeDefined();
    expect(zero?.plannedSpendCents).toBeGreaterThan(0);
  });
});

describe("payPeriodPlan — headroom at commitment time (AC5 / S8)", () => {
  test("headroom = balance + cumulative income − cumulative committed, in bucket order", () => {
    const p = plan(
      [
        paycheck(),
        bill("Soon", 15000, "2026-07-05"), // balance bucket
        bill("Water", 5000, "2026-07-22"), // 07-10 check
      ],
      { balance: 10000 },
    );
    // Bucket zero: 10000 − 15000 = −5000 → the plan breaks at today.
    expect(p.buckets[0]?.headroomAfterCents).toBe(-5000);
    expect(p.firstBreakOn).toBe("2026-07-01");
    // 07-10 check: −5000 + 100000 − 5000 (Water) = 90000.
    expect(p.buckets[1]?.headroomAfterCents).toBe(90000);
    // 07-24 check: 90000 + 100000 − 15000 (Soon's 08-05 recurrence, cutoff 07-29) = 175000.
    expect(p.buckets[2]?.headroomAfterCents).toBe(175000);
  });

  test("firstBreakOn is null when every bucket stays covered", () => {
    const p = plan([paycheck(), bill("Water", 5000, "2026-07-22")], { balance: 100000 });
    expect(p.firstBreakOn).toBeNull();
    expect(p.buckets.every((b) => b.headroomAfterCents >= 0)).toBe(true);
  });

  test("firstBreakOn names the first over-committed paycheck when the balance can't absorb it", () => {
    const p = plan(
      [
        paycheck({ amountCents: 50000, frequency: "monthly", anchorOn: "2026-07-10" }),
        bill("Big-A", 40000, "2026-08-01"),
        bill("Big-B", 30000, "2026-08-01"),
      ],
      { horizonDays: 32, balance: 10000 },
    );
    // 10000 + 50000 − 70000 = −10000 at the 07-10 check.
    expect(p.firstBreakOn).toBe("2026-07-10");
  });
});
