import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { notFound, pageQuery, paginate, query, sortQuery, textQuery } from "../http.ts";
import * as schemas from "../schemas.ts";

const SELECT = `
  s.supplier_id, s.name, s.contact_name, s.contact_title, s.address, s.city, s.region, s.postal_code,
  s.country, s.phone, s.fax, s.home_page, coalesce(p.product_count, 0) AS product_count`;

const FROM = `
  suppliers s
  LEFT JOIN (SELECT supplier_id, count(*) AS product_count FROM products GROUP BY supplier_id) p
    USING (supplier_id)`;

const toSupplier = (row: Record<string, unknown>) => schemas.supplier.parse(row);

// A supplier's products are listed by /api/products?supplier=<id>.
export const suppliers = new Hono<AppEnv>()
  .get(
    "/",
    query({
      ...pageQuery,
      name: textQuery,
      country: textQuery,
      sort: sortQuery(
        {
          supplier_id: "s.supplier_id",
          name: "s.name",
          country: "s.country",
          product_count: "product_count",
        },
        "supplier_id",
      ),
    }),
    (c) => {
      const q = c.req.valid("query");
      const where: string[] = [];
      if (q.name) where.push("instr(fold(s.name), fold(:name)) > 0");
      if (q.country) where.push("fold(s.country) = fold(:country)");
      return c.json(
        paginate(
          c.var.db,
          // supplier_id breaks ties, so a page never repeats or skips a row.
          { select: SELECT, from: FROM, where, orderBy: `${q.sort}, s.supplier_id` },
          { name: q.name ?? null, country: q.country ?? null },
          q.page,
          q.per_page,
          toSupplier,
        ),
      );
    },
  )
  .get("/:id{[0-9]+}", (c) => {
    const row = c.var.db
      .prepare(`SELECT ${SELECT} FROM ${FROM} WHERE s.supplier_id = ?`)
      .get(Number(c.req.param("id")));
    return row ? c.json(toSupplier(row)) : c.json(notFound(`supplier ${c.req.param("id")}`), 404);
  });
