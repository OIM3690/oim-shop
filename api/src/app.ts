import { Hono } from "hono";
import type { Database } from "./db.ts";
import { customers } from "./routes/customers.ts";
import { employees } from "./routes/employees.ts";
import { orders } from "./routes/orders.ts";
import { products } from "./routes/products.ts";

export interface AppOptions {
  db: Database;
  /** Boston time as "YYYY-MM-DDTHH:MM:SS"; tests pass a fixed moment. */
  now: () => string;
}

export type AppEnv = { Variables: { db: Database; now: () => string } };

export function createApp({ db, now }: AppOptions) {
  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set("db", db);
      c.set("now", now);
      await next();
    })
    .get("/health", (c) => {
      const orderCount = Number(db.prepare("SELECT count(*) AS n FROM orders").get()!.n);
      const lastSync = db.prepare("SELECT value FROM app_state WHERE key = 'last_sync_at'").get();
      return c.json({
        status: "ok" as const,
        orders: orderCount,
        last_sync: lastSync ? String(lastSync.value) : null,
      });
    })
    .get("/categories", (c) => c.json(db.prepare("SELECT * FROM categories ORDER BY category_id").all()))
    .get("/shippers", (c) => c.json(db.prepare("SELECT * FROM shippers ORDER BY shipper_id").all()))
    .route("/products", products)
    .route("/customers", customers)
    .route("/orders", orders)
    .route("/employees", employees);

  return new Hono().route("/api", api);
}
