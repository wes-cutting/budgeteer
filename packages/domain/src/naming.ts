// Shared name handling for accounts and envelopes: trim + collapse internal whitespace,
// require non-empty, enforce case-insensitive uniqueness (the latter as a pure helper the
// data layer feeds the existing names into).

// Accepted-as-is (review 2026-06-15, EH6): `normalizeName` trims AND collapses internal runs of
// whitespace, whereas the DB unique key is `lower(btrim(name))` (trim only). So normalization is a
// strict *superset* of the index's equivalence: any pair the DB would call a duplicate, this also
// calls a duplicate. The two agree in practice because the service persists the normalized name —
// the value the index sees is already collapsed. (Detail in status-reports/2026-06-15-eh3.md.)
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
