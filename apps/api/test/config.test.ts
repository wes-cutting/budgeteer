import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config";

// R13 — LOG_LEVEL is read and validated at the config boundary (spine §8): a closed enum of pino
// levels, so a typo fails loudly at startup rather than throwing deep inside pino at the first log.
describe("config — LOG_LEVEL boundary validation (R13)", () => {
  test("defaults to info when unset", () => {
    expect(loadConfig({}).LOG_LEVEL).toBe("info");
  });

  test("accepts a valid pino level", () => {
    expect(loadConfig({ LOG_LEVEL: "debug" }).LOG_LEVEL).toBe("debug");
  });

  test("rejects an unknown level loudly", () => {
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
  });
});
