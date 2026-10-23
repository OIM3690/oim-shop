// The signed-in rep. PUT /api/me sets the display name; the first time, it
// also makes the rep's employee record, reporting to Steven Buchanan (5).
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { requireUser } from "../guards.ts";
import { readEmployee } from "./employees.ts";

const MANAGER = 5;

export const displayName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(40, "Use at most 40 characters")
  .regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, "Use letters, digits, spaces, and . ' - only");

export const me = new Hono<AppEnv>()
  .get("/", (c) => {
    const user = c.var.user;
    return c.json({
      signed_in: Boolean(user),
      employee: user?.employee_id ? readEmployee(c.var.db, user.employee_id) : null,
    });
  })
  .put(
    "/",
    requireUser,
    zValidator("json", z.object({ display_name: displayName }), (result, c) => {
      if (!result.success) return c.json({ detail: result.error.issues.map((i) => i.message) }, 422);
    }),
    (c) => {
      const db = c.var.db;
      const user = c.var.user!;
      const { display_name } = c.req.valid("json");
      if (user.employee_id) {
        db.prepare("UPDATE employees SET first_name = ? WHERE employee_id = ?").run(
          display_name,
          user.employee_id,
        );
      } else {
        db.prepare(
          `INSERT INTO employees (employee_id, first_name, last_name, title, reports_to, hire_date, user_id)
           VALUES ((SELECT max(max(employee_id) + 1, 10) FROM employees), ?, '', 'Sales Representative', ?, ?, ?)`,
        ).run(display_name, MANAGER, c.var.now().slice(0, 10), user.user_id);
      }
      const employeeId = Number(
        db.prepare("SELECT employee_id FROM employees WHERE user_id = ?").get(user.user_id)!.employee_id,
      );
      return c.json({ signed_in: true, employee: readEmployee(db, employeeId) });
    },
  );
