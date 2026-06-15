import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_HOUSEHOLD_ID } from "../src/constants";
import { asDuplicateName, isUniqueViolation } from "../src/services/dbErrors";
import { DuplicateNameError } from "../src/services/errors";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

// EH3: the DB unique index on (household_id, lower(btrim(name))) is the real name guard — it
// backstops the in-app nameExists check and is the only guard under a concurrent insert. These
// tests exercise that backstop directly (the in-app check intercepts every *constructible*
// duplicate before the DB, so the index can only be reached by going around the service).
describe("DB unique-violation mapping (EH3)", () => {
  const insertAccount = (name: string) =>
    ctx.db
      .insertInto("accounts")
      .values({ household_id: DEFAULT_HOUSEHOLD_ID, name, kind: "checking", archived_at: null })
      .execute();

  test("the accounts name index rejects a case-insensitive duplicate as a unique violation", async () => {
    await insertAccount("Checking");
    let raw: unknown;
    try {
      await insertAccount("checking"); // collides via lower(btrim(name))
    } catch (e) {
      raw = e;
    }
    expect(raw).toBeDefined();
    expect(isUniqueViolation(raw)).toBe(true);
  });

  test("asDuplicateName maps the DB unique violation to DuplicateNameError (→ 409, not 500)", async () => {
    await insertAccount("Checking");
    await expect(
      asDuplicateName("An account with that name already exists.", () => insertAccount("CHECKING")),
    ).rejects.toBeInstanceOf(DuplicateNameError);
  });

  test("isUniqueViolation ignores unrelated errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false); // FK violation, not unique
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  test("asDuplicateName passes a successful write through and rethrows unrelated errors", async () => {
    await expect(asDuplicateName("dup", () => insertAccount("Savings"))).resolves.toBeDefined();
    await expect(
      asDuplicateName("dup", () => Promise.reject(new Error("unrelated"))),
    ).rejects.toThrow("unrelated");
  });
});
