import { Hono } from "hono";
import type { Database } from "./db.ts";
import { sameOriginWrites } from "./guards.ts";
import { auth } from "./routes/auth.ts";
import { customers } from "./routes/customers.ts";
import { dashboard } from "./routes/dashboard.ts";
import { employees } from "./routes/employees.ts";
import { me } from "./routes/me.ts";
import { orders } from "./routes/orders.ts";
import { products } from "./routes/products.ts";
import { readSession, type SessionUser } from "./session.ts";

export interface AppSettings {
  /** The address people open; sign-in returns here, and writes must come from it. */
  publicUrl: string;
  github: { clientId: string; clientSecret: string };
}

export interface AppOptions extends Partial<AppSettings> {
  db: Database;
  /** Boston time as "YYYY-MM-DDTHH:MM:SS"; tests pass a fixed moment. */
  now: () => string;
}

export type AppEnv = {
  Variables: { db: Database; now: () => string; settings: AppSettings; user: SessionUser | null };
};

export function createApp({ db, now, publicUrl = "http://localhost:5173", github }: AppOptions) {
  const settings: AppSettings = { publicUrl, github: github ?? { clientId: "", clientSecret: "" } };

  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set("db", db);
      c.set("now", now);
      c.set("settings", settings);
      c.set("user", readSession(c, db));
      await next();
    })
    .use(sameOriginWrites(new URL(publicUrl).origin))
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
    .route("/employees", employees)
    .route("/dashboard", dashboard)
    .route("/auth", auth)
    .route("/me", me);

  return new Hono().route("/api", api);
}
