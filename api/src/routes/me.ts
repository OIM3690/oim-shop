// The signed-in person. PUT /api/me sets the display name; the first time,
// it also makes their employee record, with the title and manager their
// role gives them (api/src/reporting.ts).
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { displayName } from "../schemas.ts";
import { requireUser } from "../guards.ts";
import { viewerOf } from "../names.ts";
import { assignReporting } from "../reporting.ts";
import { readEmployee } from "./employees.ts";

export const me = new Hono<AppEnv>()
  .get("/", (c) => {
    const user = c.var.user;
    return c.json({
      signed_in: Boolean(user),
      role: user?.role ?? null,
      employee: user?.employee_id ? readEmployee(c.var.db, user.employee_id, viewerOf(c)) : null,
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
        // The title and manager are placeholders until assignReporting sets them.
        db.prepare(
          `INSERT INTO employees (employee_id, first_name, last_name, title, hire_date, user_id)
           VALUES ((SELECT max(max(employee_id) + 1, 10) FROM employees), ?, '', 'Sales Representative', ?, ?)`,
        ).run(display_name, c.var.now().slice(0, 10), user.user_id);
        assignReporting(db);
      }
      const employeeId = Number(
        db.prepare("SELECT employee_id FROM employees WHERE user_id = ?").get(user.user_id)!.employee_id,
      );
      return c.json({
        signed_in: true,
        role: user.role,
        employee: readEmployee(db, employeeId, { viewer_role: user.role, viewer_employee: employeeId }),
      });
    },
  );
