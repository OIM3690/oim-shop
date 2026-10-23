import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Database } from "./db.ts";

export const MAX_PER_PAGE = 100;

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(25),
};

/** A text filter: trimmed, empty means no filter, and long input is refused. */
export const textQuery = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || undefined);

/**
 * A sort parameter such as "revenue" or "-revenue" (descending), limited to
 * the given columns. Returns a safe ORDER BY clause, never text from the URL.
 */
export function sortQuery(columns: Record<string, string>, fallback: string) {
  const names = Object.keys(columns);
  return z
    .enum([...names, ...names.map((n) => `-${n}`)] as [string, ...string[]])
    .default(fallback)
    .transform((value) => {
      const descending = value.startsWith("-");
      const column = columns[descending ? value.slice(1) : value];
      return `${column} ${descending ? "DESC" : "ASC"}`;
    });
}

/** Validates the query string; a bad value answers 400 with what was wrong. */
export const query = <T extends z.ZodRawShape>(shape: T) =>
  zValidator("query", z.object(shape), (result, c) => {
    if (!result.success) {
      return c.json({ detail: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
    }
  });

type Value = string | number | null;

/** One page of rows and the pagination block, from a query and a matching count. */
export function paginate<T>(
  db: Database,
  sql: { select: string; from: string; where: string[]; orderBy: string },
  params: Record<string, Value>,
  page: number,
  perPage: number,
  toItem: (row: Record<string, unknown>) => T,
) {
  const where = sql.where.length ? `WHERE ${sql.where.join(" AND ")}` : "";
  const countSql = `SELECT count(*) AS n FROM ${sql.from} ${where}`;
  const rowsSql = `SELECT ${sql.select} FROM ${sql.from} ${where} ORDER BY ${sql.orderBy} LIMIT :limit OFFSET :offset`;
  const total = Number(db.prepare(countSql).get(usedBy(countSql, params))!.n);
  const rows = db
    .prepare(rowsSql)
    .all(usedBy(rowsSql, { ...params, limit: perPage, offset: (page - 1) * perPage }));
  const pages = Math.max(1, Math.ceil(total / perPage));
  return {
    items: rows.map(toItem),
    pagination: { page, per_page: perPage, total, pages, has_next: page < pages, has_prev: page > 1 },
  };
}

/** node:sqlite refuses a named parameter the SQL does not use, so pass only the used ones. */
export function usedBy(sql: string, params: Record<string, Value>) {
  return Object.fromEntries(Object.entries(params).filter(([name]) => new RegExp(`:${name}\\b`).test(sql)));
}

export const notFound = (what: string) => ({ detail: `No ${what}` });

/** SQLite has no boolean type; 0 and 1 come back as numbers. */
export const bool = (value: unknown) => Boolean(Number(value));
