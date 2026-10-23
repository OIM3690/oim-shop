import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { bool, notFound, pageQuery, paginate, query, sortQuery } from "../http.ts";
import * as schemas from "../schemas.ts";

// Each sign-in adds a rep, so the directory has a ceiling like every other list.
export const MAX_DIRECTORY = 1000;

const NAME = (alias: string) => `trim(${alias}.first_name || ' ' || ${alias}.last_name)`;

const SELECT = `
  e.employee_id, e.first_name, e.last_name, ${NAME("e")} AS name, e.title,
  e.reports_to, ${NAME("m")} AS manager_name, e.hire_date, e.city, e.country,
  e.user_id IS NOT NULL AS is_rep,
  coalesce(t.order_count, 0) AS order_count, coalesce(t.revenue, 0) AS revenue_dollars`;

const FROM = `
  employees e
  LEFT JOIN employees m ON m.employee_id = e.reports_to
  LEFT JOIN (SELECT employee_id, count(*) AS order_count, round(sum(lines_total), 2) AS revenue
             FROM orders GROUP BY employee_id) t ON t.employee_id = e.employee_id`;

const toEmployee = (row: Record<string, unknown>) =>
  schemas.employee.parse({ ...row, is_rep: bool(row.is_rep) });

export function readEmployee(db: AppEnv["Variables"]["db"], employeeId: number) {
  const row = db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE e.employee_id = ?`).get(employeeId);
  return row ? toEmployee(row) : null;
}

export const employees = new Hono<AppEnv>()
  .get(
    "/",
    query({
      ...pageQuery,
      sort: sortQuery(
        {
          employee_id: "e.employee_id",
          name: "name",
          hire_date: "e.hire_date",
          order_count: "order_count",
          revenue: "revenue_dollars",
        },
        "employee_id",
      ),
    }),
    (c) => {
      const q = c.req.valid("query");
      const page = paginate(
        c.var.db,
        // employee_id breaks ties, so a page never repeats or skips a row.
        { select: SELECT, from: FROM, where: [], orderBy: `${q.sort}, e.employee_id` },
        {},
        q.page,
        q.per_page,
        toEmployee,
      );
      return c.json(page);
    },
  )
  .get("/directory", (c) =>
    c.json(
      schemas.directory.parse(
        c.var.db
          .prepare(
            `SELECT employee_id, ${NAME("e")} AS name, title, reports_to FROM employees e
             ORDER BY employee_id LIMIT ?`,
          )
          .all(MAX_DIRECTORY),
      ),
    ),
  )
  .get("/:id{[0-9]+}", (c) => {
    const found = readEmployee(c.var.db, Number(c.req.param("id")));
    return found ? c.json(found) : c.json(notFound(`employee ${c.req.param("id")}`), 404);
  });
