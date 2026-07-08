import { describe, expect, test } from "vitest";
import {
  type StillOwedRule,
  anchorDayOf,
  daysInMonth,
  dueOccurrences,
  isRecurringFrequency,
  nextOccurrence,
  stillOwedCents,
} from "../src/index";

describe("recurring schedule (FEAT-009)", () => {
  test("weekly and biweekly add 7 / 14 days across month and year boundaries", () => {
    expect(nextOccurrence("2026-06-25", "weekly", 25)).toBe("2026-07-02");
    expect(nextOccurrence("2026-06-25", "biweekly", 25)).toBe("2026-07-09");
    expect(nextOccurrence("2026-12-29", "weekly", 29)).toBe("2027-01-05");
  });

  test("monthly preserves the anchor day, clamping short months — 31 → Feb 28 → Mar 31", () => {
    expect(nextOccurrence("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    // From the clamped Feb date, March returns to the 31st (clamps off the ANCHOR, not Feb 28).
    expect(nextOccurrence("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2026-12-15", "monthly", 15)).toBe("2027-01-15");
  });

  test("daysInMonth handles leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(anchorDayOf("2026-01-31")).toBe(31);
  });

  test("dueOccurrences catches up every missed period and parks the cursor in the future", () => {
    // Biweekly paycheck anchored 2026-05-01, run on 2026-06-14.
    const { dates, nextCursor } = dueOccurrences("2026-05-01", "2026-06-14", "biweekly", 1);
    expect(dates).toEqual(["2026-05-01", "2026-05-15", "2026-05-29", "2026-06-12"]);
    expect(nextCursor).toBe("2026-06-26");
    expect(nextCursor > "2026-06-14").toBe(true);
  });

  test("dueOccurrences includes an occurrence falling exactly on today", () => {
    const { dates } = dueOccurrences("2026-06-14", "2026-06-14", "monthly", 14);
    expect(dates).toEqual(["2026-06-14"]);
  });

  test("nothing is due when the cursor is in the future (idempotent re-run)", () => {
    const { dates, nextCursor } = dueOccurrences("2026-07-01", "2026-06-14", "monthly", 1);
    expect(dates).toEqual([]);
    expect(nextCursor).toBe("2026-07-01");
  });

  test("isRecurringFrequency guards the enum", () => {
    expect(isRecurringFrequency("monthly")).toBe(true);
    expect(isRecurringFrequency("yearly")).toBe(false);
  });
});

describe("stillOwedCents (FEAT-S9)", () => {
  const rule = (over: Partial<StillOwedRule>): StillOwedRule => ({
    direction: "withdrawal",
    amountCents: 10_000,
    frequency: "monthly",
    anchorOn: "2026-01-15",
    nextOccurrenceOn: "2026-07-15",
    ...over,
  });

  test("sums withdrawal occurrences from each rule's cursor through month-end", () => {
    const rules = [
      // Monthly on the 15th, unposted from July: one occurrence left this month.
      rule({}),
      // Weekly on Fridays, cursor 2026-07-10: 10th, 17th, 24th, 31st = 4 × $25.
      rule({
        amountCents: 2_500,
        frequency: "weekly",
        anchorOn: "2026-07-03",
        nextOccurrenceOn: "2026-07-10",
      }),
    ];
    expect(stillOwedCents(rules, "2026-07-31")).toBe(10_000 + 4 * 2_500);
  });

  test("past-due unposted occurrences still count — posting is what clears them", () => {
    // Monthly on the 1st, never posted since June: June 1 + July 1 both still owed.
    const r = rule({ anchorOn: "2026-06-01", nextOccurrenceOn: "2026-06-01" });
    expect(stillOwedCents([r], "2026-07-31")).toBe(2 * 10_000);
  });

  test("deposits contribute nothing; a cursor past month-end contributes nothing", () => {
    const deposit = rule({ direction: "deposit", amountCents: 150_000 });
    const nextMonth = rule({ nextOccurrenceOn: "2026-08-15" });
    expect(stillOwedCents([deposit, nextMonth], "2026-07-31")).toBe(0);
  });
});
