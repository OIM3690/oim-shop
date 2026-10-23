import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./app.ts";

/** Answers 401 unless someone is signed in. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ detail: "Sign in to do this." }, 401);
  await next();
});

/** Answers 403 unless the signed-in user has chosen a name and so has an employee record. */
export const requireRep = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ detail: "Sign in to do this." }, 401);
  if (!c.var.user.employee_id) return c.json({ detail: "Choose your display name first." }, 403);
  await next();
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * A write must come from the app's own pages. Browsers send an Origin header
 * with every POST, PUT, PATCH and DELETE, so a request started by another
 * site, or one with no Origin at all, is refused.
 */
export const sameOriginWrites = (origin: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method) && c.req.header("Origin") !== origin) {
      return c.json({ detail: "This request must come from the oim-shop site." }, 403);
    }
    await next();
  });
