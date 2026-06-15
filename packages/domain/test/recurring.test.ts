import { describe, expect, test } from "vitest";
import {
  anchorDayOf,
  daysInMonth,
  dueOccurrences,
  isRecurringFrequency,
  nextOccurrence,
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
