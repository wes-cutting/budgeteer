import { describe, expect, test } from "vitest";
import { nameExists, normalizeName, validateName } from "../src/naming";
import { validateAccountName } from "../src/account";
import { validateEnvelopeName } from "../src/envelope";

describe("naming", () => {
  test("normalizeName trims and collapses whitespace", () => {
    expect(normalizeName("  Dine   Out  ")).toBe("Dine Out");
  });

  test("validateName rejects empty/whitespace and over-long", () => {
    expect(validateName("   ", "Account")).toEqual({
      ok: false,
      reason: "Account name is required.",
    });
    expect(validateName("a".repeat(101), "Envelope").ok).toBe(false);
    expect(validateName("  Groceries ", "Envelope")).toEqual({ ok: true, name: "Groceries" });
  });

  test("nameExists is case-insensitive and whitespace-normalized", () => {
    const existing = ["Checking", "Dine Out"];
    expect(nameExists(existing, "checking")).toBe(true);
    expect(nameExists(existing, "  dine   out ")).toBe(true);
    expect(nameExists(existing, "Savings")).toBe(false);
  });

  test("entity validators delegate with their label", () => {
    expect(validateAccountName("").ok).toBe(false);
    expect(validateEnvelopeName("Rent")).toEqual({ ok: true, name: "Rent" });
  });
});
