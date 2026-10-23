import { z } from "zod";

/** A sort search param limited to the given API sort keys, each ascending or with "-" descending. */
export function sortParam<const T extends readonly string[]>(fields: T) {
  // z.enum needs a non-empty tuple; every field adds two entries, so this one is.
  const values = fields.flatMap((f) => [f, `-${f}`]) as [string, ...string[]];
  return z.enum(values).optional().catch(undefined);
}

/** The sort in the address and how to change it; `defaultSort` is what the API uses without one. */
export interface TableSorting {
  sort: string | undefined;
  onSort: (sort: string | undefined) => void;
  defaultSort?: string;
}

/** Which way `field` is sorted, counting the API's default order when no sort is chosen. */
export function sortDirection(field: string, { sort, defaultSort }: TableSorting) {
  const current = sort ?? defaultSort;
  return current === field ? "ascending" : current === `-${field}` ? "descending" : "none";
}
