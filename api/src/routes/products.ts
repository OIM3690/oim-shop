import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { bool, notFound, pageQuery, paginate, query, sortQuery, textQuery } from "../http.ts";
import * as schemas from "../schemas.ts";

const SELECT = `
  p.product_id, p.name, p.category_id, c.name AS category, s.name AS supplier, p.quantity_per_unit,
  p.unit_price AS unit_price_dollars, p.units_in_stock, p.reorder_level,
  p.units_in_stock < p.reorder_level AS low_stock, p.discontinued,
  coalesce(r.revenue, 0) AS revenue_dollars`;

const FROM = `
  products p
  JOIN categories c USING (category_id)
  JOIN suppliers s USING (supplier_id)
  LEFT JOIN (SELECT product_id, round(sum(revenue), 2) AS revenue FROM product_month_sales GROUP BY product_id) r
    USING (product_id)`;

const toProduct = (row: Record<string, unknown>) =>
  schemas.product.parse({ ...row, low_stock: bool(row.low_stock), discontinued: bool(row.discontinued) });

export const products = new Hono<AppEnv>()
  .get(
    "/",
    query({
      ...pageQuery,
      name: textQuery,
      category: z.coerce.number().int().positive().optional(),
      sort: sortQuery(
        {
          product_id: "p.product_id",
          name: "p.name",
          unit_price: "p.unit_price",
          units_in_stock: "p.units_in_stock",
          revenue: "revenue_dollars",
        },
        "product_id",
      ),
    }),
    (c) => {
      const q = c.req.valid("query");
      const where: string[] = [];
      if (q.name) where.push("instr(fold(p.name), fold(:name)) > 0");
      if (q.category) where.push("p.category_id = :category");
      const page = paginate(
        c.var.db,
        // product_id breaks ties, so a page never repeats or skips a row.
        { select: SELECT, from: FROM, where, orderBy: `${q.sort}, p.product_id` },
        { name: q.name ?? null, category: q.category ?? null },
        q.page,
        q.per_page,
        toProduct,
      );
      return c.json(page);
    },
  )
  .get("/:id{[0-9]+}", (c) => {
    const row = c.var.db
      .prepare(`SELECT ${SELECT} FROM ${FROM} WHERE p.product_id = ?`)
      .get(Number(c.req.param("id")));
    return row ? c.json(toProduct(row)) : c.json(notFound(`product ${c.req.param("id")}`), 404);
  });
