import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with node's built-in **scrypt** (memory-hard KDF, SECURITY.md §3) — no native /
 * wasm dependency on the ARM64 hub (validated in SPIKE-13). The cost parameters live in the hash
 * string (`scrypt$N$r$p$saltHex$hashHex`) so they can be raised later without a migration: an old
 * hash still verifies against its own stored parameters.
 */
const N = 16384; // CPU/memory cost (2^14)
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${dk.toString("hex")}`;
}

/** Constant-time verify. Returns false on any malformed hash rather than throwing. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  const [scheme, n, r, p, saltHex, hashHex] = parts;
  if (parts.length !== 6 || scheme !== "scrypt" || !n || !r || !p || !saltHex || !hashHex)
    return false;
  const expected = Buffer.from(hashHex, "hex");
  let dk: Buffer;
  try {
    dk = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}
