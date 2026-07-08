import { describe, expect, test } from "vitest";
import { amountFieldError } from "./validation";

describe("amountFieldError (UX12d inline validation)", () => {
  test("empty input is not an error (required-ness is gated separately)", () => {
    expect(amountFieldError("")).toBeNull();
    expect(amountFieldError("   ")).toBeNull();
  });

  test("parseable amounts pass (whole, decimal, signed, padded, surrounding space)", () => {
    for (const ok of ["1", "1.5", "12.34", "0.07", "-300.00", " 5 "]) {
      expect(amountFieldError(ok)).toBeNull();
    }
  });

  test("un-parseable input returns an actionable, format-showing message", () => {
    for (const bad of ["abc", "12,00", "1.", "$5", "1.234"]) {
      expect(amountFieldError(bad)).toBe("Enter an amount like 12.34.");
    }
  });
});
