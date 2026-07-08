import { afterEach, describe, expect, test, vi } from "vitest";
import { localMonth, localMonthRange, localToday } from "./dates";

// The pinned instants are built with the LOCAL Date constructor, so the expected calendar day
// holds in every timezone — including late evening, where a UTC derivation (`toISOString`)
// would already have rolled to the next day/month west of UTC (the EH8 bug).
describe("local calendar-date helpers (EH8)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("localToday/localMonth stay on the local calendar day late in the evening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 2, 23, 30)); // 2026-07-02 23:30 local
    expect(localToday()).toBe("2026-07-02");
    expect(localMonth()).toBe("2026-07");
  });

  test("localMonthRange spans the local month, last evening included", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 23, 30)); // 2026-07-31 23:30 local
    expect(localMonthRange()).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  test("localMonthRange handles a leap February", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2028, 1, 5)); // 2028-02-05 local; 2028 is a leap year
    expect(localMonthRange()).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
