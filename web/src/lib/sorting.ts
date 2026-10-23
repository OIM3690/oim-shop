import { z } from "zod";

/** A sort search param limited to the given API sort keys, each ascending or with "-" descending. */
export function sortParam<const T extends readonly string[]>(fields: T) {
  // z.enum needs a non-empty tuple; every field adds two entries, so this one is.
  const values = fields.flatMap((f) => [f, `-${f}`]) as [string, ...string[]];
  return z.enum(values).optional().catch(undefined);
}
