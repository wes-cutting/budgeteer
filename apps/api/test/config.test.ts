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

// EH11 — the API binds loopback unless explicitly told otherwise: with no auth (#19), the
// reachable surface must stay as small as the auth story (SECURITY.md §3). Exposing the API to
// the network is a deliberate, validated opt-in, never the default.
describe("config — HOST boundary validation (EH11)", () => {
  test("defaults to loopback when unset", () => {
    expect(loadConfig({}).HOST).toBe("127.0.0.1");
  });

  test("accepts an explicit opt-in to a wider bind", () => {
    expect(loadConfig({ HOST: "0.0.0.0" }).HOST).toBe("0.0.0.0");
  });

  test("rejects a blank host loudly", () => {
    expect(() => loadConfig({ HOST: "   " })).toThrow(/HOST/);
  });
});
