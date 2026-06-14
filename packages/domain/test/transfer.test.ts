import { describe, expect, test } from "vitest";
import {
  accountBalance,
  cents,
  envelopeBalanceWithTransfers,
  transferLegs,
  validateEnvelopeTransfer,
  validateTransfer,
} from "../src/index";

describe("account transfer (FEAT-007 / ADR-0004)", () => {
  test("validateTransfer accepts a positive magnitude between distinct accounts", () => {
    expect(validateTransfer("a", "b", 25000)).toEqual({ ok: true });
  });

  test("validateTransfer rejects non-positive magnitudes and same-account transfers", () => {
    expect(validateTransfer("a", "b", 0).ok).toBe(false);
    expect(validateTransfer("a", "b", -5).ok).toBe(false);
    expect(validateTransfer("a", "b", 12.5).ok).toBe(false); // non-integer cents
    expect(validateTransfer("a", "a", 100).ok).toBe(false);
  });

  test("transferLegs are signed ∓magnitude and sum to zero (money conserved)", () => {
    const [out, into] = transferLegs("checking", "savings", cents(25000));
    expect(out).toEqual({ accountId: "checking", amountCents: -25000 });
    expect(into).toEqual({ accountId: "savings", amountCents: 25000 });
    expect(out.amountCents + into.amountCents).toBe(0);
  });

  test("odd cents stay exact and balances derive from the legs", () => {
    const [out, into] = transferLegs("checking", "savings", cents(3333));
    // checking started at $1000, savings at $0
    expect(accountBalance([{ amountCents: cents(100000) }, out])).toBe(96667);
    expect(accountBalance([into])).toBe(3333);
  });
});

describe("envelope reallocation (FEAT-007 #7b / ADR-0004 B)", () => {
  test("validateEnvelopeTransfer accepts a positive magnitude between distinct envelopes", () => {
    expect(validateEnvelopeTransfer("groceries", "vacation", 15000)).toEqual({ ok: true });
  });

  test("validateEnvelopeTransfer rejects non-positive magnitudes and same-envelope moves", () => {
    expect(validateEnvelopeTransfer("a", "b", 0).ok).toBe(false);
    expect(validateEnvelopeTransfer("a", "b", -1).ok).toBe(false);
    expect(validateEnvelopeTransfer("a", "b", 1.5).ok).toBe(false);
    expect(validateEnvelopeTransfer("a", "a", 100).ok).toBe(false);
  });

  test("envelopeBalanceWithTransfers = allocations + incoming − outgoing (exact, may go negative)", () => {
    // Groceries: $600 allocated, received $150, sent $0 → $750
    expect(envelopeBalanceWithTransfers(60000, 15000, 0)).toBe(75000);
    // Vacation: $400 allocated, received $0, sent $150 → $250
    expect(envelopeBalanceWithTransfers(40000, 0, 15000)).toBe(25000);
    // Draining more than present is allowed → negative balance
    expect(envelopeBalanceWithTransfers(10000, 0, 15000)).toBe(-5000);
  });
});
