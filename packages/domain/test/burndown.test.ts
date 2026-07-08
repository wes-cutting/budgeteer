import { describe, expect, test } from "vitest";
import { assessBurndown, monthElapsedFraction } from "../src/burndown";

describe("monthElapsedFraction", () => {
  test("0 before the month starts, 1 after it ends", () => {
    expect(monthElapsedFraction("2026-06", "2026-05-31")).toBe(0);
    expect(monthElapsedFraction("2026-06", "2026-07-01")).toBe(1);
    // a distant future/past month, either side
    expect(monthElapsedFraction("2027-01", "2026-06-15")).toBe(0);
    expect(monthElapsedFraction("2025-01", "2026-06-15")).toBe(1);
  });

  test("partway through the current month → day ÷ days-in-month", () => {
    expect(monthElapsedFraction("2026-06", "2026-06-15")).toBeCloseTo(15 / 30, 10); // 30-day month
    expect(monthElapsedFraction("2026-07", "2026-07-31")).toBe(1); // last day of a 31-day month
    expect(monthElapsedFraction("2026-02", "2026-02-28")).toBe(1); // non-leap February
    expect(monthElapsedFraction("2024-02", "2024-02-29")).toBe(1); // leap February
    expect(monthElapsedFraction("2026-06", "2026-06-01")).toBeCloseTo(1 / 30, 10);
  });

  test("rejects malformed month/date strings", () => {
    expect(() => monthElapsedFraction("2026-6", "2026-06-15")).toThrow(/invalid month/);
    expect(() => monthElapsedFraction("2026-06", "2026-06")).toThrow(/invalid date/);
  });
});

describe("assessBurndown", () => {
  test("over-pace: consuming budget faster than the month elapses", () => {
    // day 15 of 30 (50% elapsed), $80 of a $100 budget spent (80% consumed) ⇒ over pace
    const a = assessBurndown(
      { month: "2026-06", targetCents: 10000, spentCents: 8000 },
      "2026-06-15",
    );
    expect(a.elapsedFraction).toBeCloseTo(0.5, 10);
    expect(a.consumedFraction).toBeCloseTo(0.8, 10);
    expect(a.status).toBe("over-pace");
  });

  test("on-track: consuming at or below the elapsed pace", () => {
    // 50% elapsed, 40% consumed ⇒ on track
    const under = assessBurndown(
      { month: "2026-06", targetCents: 10000, spentCents: 4000 },
      "2026-06-15",
    );
    expect(under.status).toBe("on-track");
    // exactly at pace (50% / 50%) is still on-track (boundary is inclusive)
    const exact = assessBurndown(
      { month: "2026-06", targetCents: 10000, spentCents: 5000 },
      "2026-06-15",
    );
    expect(exact.status).toBe("on-track");
  });

  test("over-budget: spent past the whole target, reported ahead of pace", () => {
    const a = assessBurndown(
      { month: "2026-06", targetCents: 10000, spentCents: 12000 },
      "2026-06-10",
    );
    expect(a.consumedFraction).toBeCloseTo(1.2, 10);
    expect(a.status).toBe("over-budget"); // over-budget wins even though it's also over pace
  });

  test("a completed month degenerates to budget-vs-actual (elapsed = 1)", () => {
    // last month, fully elapsed: within target = on-track, past target = over-budget
    const within = assessBurndown(
      { month: "2026-05", targetCents: 10000, spentCents: 9000 },
      "2026-06-15",
    );
    expect(within.elapsedFraction).toBe(1);
    expect(within.status).toBe("on-track");
    const over = assessBurndown(
      { month: "2026-05", targetCents: 10000, spentCents: 11000 },
      "2026-06-15",
    );
    expect(over.status).toBe("over-budget");
  });

  test("rejects a non-positive target (nothing to burn down)", () => {
    expect(() =>
      assessBurndown({ month: "2026-06", targetCents: 0, spentCents: 100 }, "2026-06-15"),
    ).toThrow(/positive target/);
  });
});
