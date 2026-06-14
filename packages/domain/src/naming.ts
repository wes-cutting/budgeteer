// Shared name handling for accounts and envelopes: trim + collapse internal whitespace,
// require non-empty, enforce case-insensitive uniqueness (the latter as a pure helper the
// data layer feeds the existing names into).

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export type NameValidation = { ok: true; name: string } | { ok: false; reason: string };

export function validateName(raw: string, label: string): NameValidation {
  const name = normalizeName(raw);
  if (name.length === 0) return { ok: false, reason: `${label} name is required.` };
  if (name.length > 100) return { ok: false, reason: `${label} name is too long (max 100).` };
  return { ok: true, name };
}

/** Case-insensitive existence check against an existing set of (normalized or raw) names. */
export function nameExists(existing: readonly string[], candidate: string): boolean {
  const c = normalizeName(candidate).toLowerCase();
  return existing.some((n) => normalizeName(n).toLowerCase() === c);
}
