/** Drops empty values, so they leave the address instead of showing as "?name=". */
export function cleanSearch<T extends Record<string, unknown>>(search: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(search).filter(([, value]) => value !== undefined && value !== ""),
    // fromEntries loses the key types; the keys kept are a subset of T.
  ) as Partial<T>;
}
