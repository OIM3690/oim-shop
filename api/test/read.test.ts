import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app.ts";
import * as schemas from "../src/schemas.ts";
import { freshDb, one, TEST_NOW } from "./helpers.ts";

const db = freshDb();
const app = createApp({ db, now: () => TEST_NOW });

// The tests below poke at single fields, so the body is loosely typed here;
// "every response matches its schema" checks the full shapes.
type Json = any;

async function get(path: string): Promise<{ status: number; body: Json }> {
  const response = await app.request(path);
  return { status: response.status, body: await response.json() };
}

const LINE = "round(l.unit_price * l.quantity * (1 - l.discount), 2)";
const revenueOfProduct = (id: number) =>
  one(db, `SELECT round(sum(${LINE}), 2) AS r FROM order_lines l WHERE product_id = ?`, id).r;

describe("products", () => {
  it("lists a page with the total, and each product's revenue and stock flag", async () => {
    const { status, body } = await get("/api/products");
    expect(status).toBe(200);
    expect(body.pagination).toEqual({
      page: 1,
      per_page: 25,
      total: 77,
      pages: 4,
      has_next: true,
      has_prev: false,
    });
    const chai = body.items[0];
    expect(chai).toMatchObject({
      product_id: 1,
      name: "Chai",
      category: "Beverages",
      supplier: "Exotic Liquids",
    });
    expect(chai.revenue_dollars).toBe(revenueOfProduct(1));
    const low = one(db, "SELECT count(*) AS n FROM products WHERE units_in_stock < reorder_level").n;
    const all = (await get("/api/products?per_page=100")).body.items;
    expect(all.filter((p: { low_stock: boolean }) => p.low_stock)).toHaveLength(low as number);
  });

  it("searches part of the name in any case, as plain text", async () => {
    const expected = one(db, "SELECT count(*) AS n FROM products WHERE lower(name) LIKE '%ch%'").n;
    expect((await get("/api/products?name=CH")).body.pagination.total).toBe(expected);
    expect((await get("/api/products?name=%25")).body.pagination.total).toBe(0);
  });

  it("filters by category and sorts on the server", async () => {
    expect((await get("/api/products?category=1")).body.pagination.total).toBe(12);
    const top = (await get("/api/products?sort=-revenue&per_page=1")).body.items[0];
    const best = one(
      db,
      `SELECT product_id FROM order_lines l GROUP BY product_id ORDER BY sum(${LINE}) DESC LIMIT 1`,
    ).product_id;
    expect(top.product_id).toBe(best);
    const cheapest = (await get("/api/products?sort=unit_price&per_page=1")).body.items[0];
    expect(cheapest.unit_price_dollars).toBe(one(db, "SELECT min(unit_price) AS p FROM products").p);
  });

  it("refuses an unbounded or unknown query", async () => {
    expect((await get("/api/products?per_page=500")).status).toBe(400);
    expect((await get("/api/products?sort=password")).status).toBe(400);
    expect((await get("/api/products?page=0")).status).toBe(400);
  });

  it("returns one product, or 404", async () => {
    expect((await get("/api/products/17")).body).toMatchObject({ name: "Alice Mutton", discontinued: true });
    const missing = await get("/api/products/999");
    expect(missing.status).toBe(404);
    expect(missing.body.detail).toBe("No product 999");
  });
});

describe("customers", () => {
  it("lists with search, country and each customer's revenue", async () => {
    const { body } = await get("/api/customers?country=Germany&sort=-revenue");
    expect(body.pagination.total).toBe(
      one(db, "SELECT count(*) AS n FROM customers WHERE country = 'Germany'").n,
    );
    const first = body.items[0];
    expect(first.revenue_dollars).toBe(
      one(db, "SELECT round(sum(lines_total), 2) AS r FROM orders WHERE customer_id = ?", first.customer_id)
        .r,
    );
    expect((await get("/api/customers?name=markt")).body.pagination.total).toBe(2);
  });

  it("finds a customer whose ID has a trailing space", async () => {
    expect((await get("/api/customers/val2")).body.customer_id).toBe("Val2 ");
    expect((await get("/api/customers/NOPE")).status).toBe(404);
  });
});

describe("orders", () => {
  it("lists the newest first, with the same fields as oim-api", async () => {
    const { body } = await get("/api/orders?per_page=2");
    expect(body.pagination.total).toBe(one(db, "SELECT count(*) AS n FROM orders").n);
    expect(body.items[0]).toMatchObject({
      order_id: 21646,
      customer_name: "IT",
      employee_name: "Michael Suyama",
      order_total_dollars: 2743.65,
      line_count: 6,
      shipped_date: null,
    });
  });

  it("filters like oim-api, both dates included", async () => {
    const count = (where: string) => one(db, `SELECT count(*) AS n FROM orders WHERE ${where}`).n;
    expect((await get("/api/orders?employee_id=5")).body.pagination.total).toBe(count("employee_id = 5"));
    expect((await get("/api/orders?customer_id=alfki")).body.pagination.total).toBe(
      count("customer_id = 'ALFKI'"),
    );
    expect((await get("/api/orders?country=germany")).body.pagination.total).toBe(
      count("ship_country = 'Germany'"),
    );
    expect((await get("/api/orders?from_date=2026-10-20&to_date=2026-10-21")).body.pagination.total).toBe(
      count("substr(order_date, 1, 10) BETWEEN '2026-10-20' AND '2026-10-21'"),
    );
  });

  it("sorts by total", async () => {
    const top = (await get("/api/orders?sort=-order_total&per_page=1")).body.items[0];
    expect(top.order_total_dollars).toBe(one(db, "SELECT max(lines_total) AS t FROM orders").t);
  });

  it("returns an order with its lines", async () => {
    const { body } = await get("/api/orders/10248");
    expect(body.lines).toEqual([
      expect.objectContaining({
        product_id: 11,
        product_name: "Queso Cabrales",
        quantity: 12,
        line_total_dollars: 168,
      }),
      expect.objectContaining({ product_id: 42, line_total_dollars: 98 }),
      expect.objectContaining({ product_id: 72, line_total_dollars: 174 }),
    ]);
    expect((await get("/api/orders/1")).status).toBe(404);
  });
});

describe("employees", () => {
  it("lists a page of employees with orders, revenue and the manager's name", async () => {
    const { body } = await get("/api/employees");
    expect(body.pagination).toMatchObject({ page: 1, total: 9, pages: 1 });
    const steven = body.items.find((e: { employee_id: number }) => e.employee_id === 5);
    expect(steven.order_count).toBe(one(db, "SELECT count(*) AS n FROM orders WHERE employee_id = 5").n);
    expect(steven.revenue_dollars).toBe(
      one(
        db,
        `SELECT round(sum(${LINE}), 2) AS r FROM order_lines l JOIN orders USING (order_id) WHERE employee_id = 5`,
      ).r,
    );
    expect(steven.manager_name).toBe("Andrew Fuller");
    expect((await get("/api/employees/5")).body).toMatchObject({
      first_name: "Steven",
      reports_to: 2,
      manager_name: "Andrew Fuller",
    });
    expect((await get("/api/employees/2")).body.manager_name).toBeNull();
    expect((await get("/api/employees/99")).status).toBe(404);
  });

  it("pages and sorts on the server", async () => {
    const page = (await get("/api/employees?per_page=4&page=3")).body;
    expect(page.items).toHaveLength(1);
    expect(page.pagination).toMatchObject({ page: 3, pages: 3, total: 9 });
    const top = (await get("/api/employees?sort=-revenue&per_page=1")).body.items[0];
    const best = one(
      db,
      "SELECT employee_id FROM orders GROUP BY employee_id ORDER BY sum(lines_total) DESC LIMIT 1",
    );
    expect(top.employee_id).toBe(best.employee_id);
    expect((await get("/api/employees?sort=-hire_date&per_page=1")).body.items[0].first_name).toBe("Anne");
    expect((await get("/api/employees?sort=password")).status).toBe(400);
  });

  it("gives everyone's name, title and manager for the reporting lines and menus", async () => {
    const { body } = await get("/api/employees/directory");
    expect(body).toHaveLength(9);
    expect(body[0]).toEqual({
      employee_id: 1,
      name: "Nancy Davolio",
      title: "Sales Representative",
      reports_to: 2,
    });
  });
});

describe("health", () => {
  it("reports the database and the last sync", async () => {
    const { status, body } = await get("/api/health");
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ok", last_sync: null });
    expect(body.orders).toBeGreaterThan(15000);
  });
});

describe("the category list", () => {
  it("sends names and descriptions, not the pictures' bytes", async () => {
    const { body } = await get("/api/categories");
    expect(Object.keys(body[0]).sort()).toEqual(["category_id", "description", "name"]);
  });
});

describe("every response matches its schema", () => {
  it.each([
    ["/api/products?per_page=100", schemas.pageOf(schemas.product)],
    ["/api/products/1", schemas.product],
    ["/api/customers?per_page=100", schemas.pageOf(schemas.customer)],
    ["/api/customers/ALFKI", schemas.customer],
    ["/api/orders?per_page=100", schemas.pageOf(schemas.orderSummary)],
    ["/api/orders/10248", schemas.order],
    ["/api/employees", schemas.pageOf(schemas.employee)],
    ["/api/employees/directory", schemas.directory],
    ["/api/employees/1", schemas.employeeDetail],
    ["/api/suppliers?per_page=100", schemas.pageOf(schemas.supplier)],
    ["/api/suppliers/1", schemas.supplier],
    ["/api/regions", schemas.regions],
    ["/api/categories", z.array(schemas.category)],
    ["/api/shippers", z.array(schemas.shipper)],
    ["/api/health", schemas.health],
  ] as const)("%s", async (path, schema) => {
    const { status, body } = await get(path);
    expect(status).toBe(200);
    expect(schema.safeParse(body).success).toBe(true);
  });
});
