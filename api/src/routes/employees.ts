import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { bool, notFound } from "../http.ts";
import * as schemas from "../schemas.ts";

const SELECT = `
  e.employee_id, e.first_name, e.last_name, trim(e.first_name || ' ' || e.last_name) AS name, e.title,
  e.reports_to, e.hire_date, e.city, e.country, e.user_id IS NOT NULL AS is_rep,
  coalesce(t.order_count, 0) AS order_count, coalesce(t.revenue, 0) AS revenue_dollars`;

const FROM = `
  employees e
  LEFT JOIN (SELECT employee_id, count(*) AS order_count, round(sum(lines_total), 2) AS revenue
             FROM orders GROUP BY employee_id) t USING (employee_id)`;

const toEmployee = (row: Record<string, unknown>) =>
  schemas.employee.parse({ ...row, is_rep: bool(row.is_rep) });

export function readEmployee(db: AppEnv["Variables"]["db"], employeeId: number) {
  const row = db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE e.employee_id = ?`).get(employeeId);
  return row ? toEmployee(row) : null;
}

export const employees = new Hono<AppEnv>()
  .get("/", (c) =>
    c.json(c.var.db.prepare(`SELECT ${SELECT} FROM ${FROM} ORDER BY e.employee_id`).all().map(toEmployee)),
  )
  .get("/:id{[0-9]+}", (c) => {
    const found = readEmployee(c.var.db, Number(c.req.param("id")));
    return found ? c.json(found) : c.json(notFound(`employee ${c.req.param("id")}`), 404);
  });
