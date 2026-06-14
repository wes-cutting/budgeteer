import { describe, expect, test } from "vitest";
import { parseMoney } from "../src/money";
import { accountBalance } from "../src/transaction";
import {
  allocatedTotal,
  envelopeBalance,
  isFullyAllocated,
  unallocated,
  validateAllocations,
} from "../src/allocation";
import { isAccountKind } from "../src/account";
import { canReceiveAllocations, isEnvelopeKind } from "../src/envelope";

const amt = (s: string) => ({ amountCents: parseMoney(s) });

describe("derived balances", () => {
  test("account balance is the sum of its transactions (incl. opening)", () => {
    expect(accountBalance([amt("2000.00"), amt("-48.20"), amt("-12.00")])).toBe(
      parseMoney("1939.80"),
    );
    expect(accountBalance([])).toBe(0);
  });

  test("envelope balance is the sum of its allocations", () => {
    expect(envelopeBalance([amt("160.00"), amt("-10.00")])).toBe(parseMoney("150.00"));
  });
});

describe("split invariant (allocations vs. transaction amount)", () => {
  test("partial allocation is allowed and the remainder is exact", () => {
    const amount = parseMoney("3200.00");
    const allocs = [amt("1400.00"), amt("600.00")];
    expect(allocatedTotal(allocs)).toBe(parseMoney("2000.00"));
    expect(unallocated(amount, allocs)).toBe(parseMoney("1200.00"));
    expect(isFullyAllocated(amount, allocs)).toBe(false);
    expect(validateAllocations(amount, allocs)).toEqual({ ok: true });
  });

  test("fully allocated ⇔ remainder is zero", () => {
    const amount = parseMoney("214.00");
    const allocs = [amt("160.00"), amt("40.00"), amt("14.00")];
    expect(unallocated(amount, allocs)).toBe(0);
    expect(isFullyAllocated(amount, allocs)).toBe(true);
  });

  test("over-allocation is rejected; sign mismatches are rejected", () => {
    expect(validateAllocations(parseMoney("100.00"), [amt("150.00")]).ok).toBe(false);
    expect(validateAllocations(parseMoney("-50.00"), [amt("10.00")]).ok).toBe(false);
    expect(validateAllocations(parseMoney("-214.00"), [amt("-160.00"), amt("-40.00")]).ok).toBe(
      true,
    );
  });
});

describe("kind guards & lifecycle", () => {
  test("kind type guards", () => {
    expect(isAccountKind("checking")).toBe(true);
    expect(isAccountKind("bogus")).toBe(false);
    expect(isEnvelopeKind("sinking_fund")).toBe(true);
  });

  test("archived envelopes cannot receive allocations", () => {
    expect(canReceiveAllocations({ archivedAt: null })).toBe(true);
    expect(canReceiveAllocations({ archivedAt: new Date() })).toBe(false);
  });
});
