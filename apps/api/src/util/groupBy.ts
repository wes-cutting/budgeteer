/**
 * Group a flat list of rows into a `Map` keyed by a derived id, mapping each row to a value as it
 * goes. Captures the "fetch children → bucket by parent id → attach to parents" shape repeated
 * across the transaction / template / recurring services. Insertion order within each bucket is
 * preserved, so an upstream `order by position` survives the grouping.
 */
export function groupBy<T, V>(
  items: readonly T[],
  keyOf: (item: T) => string,
  valueOf: (item: T) => V,
): Map<string, V[]> {
  const map = new Map<string, V[]>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = map.get(key);
    if (existing) existing.push(valueOf(item));
    else map.set(key, [valueOf(item)]);
  }
  return map;
}
