import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireUser } from "../guards.ts";
import { bool, notFound, pageQuery, paginate, query, sortQuery, usedBy } from "../http.ts";
import { shownName, viewerOf, type Viewer } from "../names.ts";
import * as schemas from "../schemas.ts";

// Each sign-in adds a rep, so the directory has a ceiling like every other list.
export const MAX_DIRECTORY = 1000;

// A rep's last name is empty, so the first name carries the name shown.
const SELECT = `
  e.employee_id, CASE WHEN e.user_id IS NULL THEN e.first_name ELSE ${shownName("e")} END AS first_name,
  e.last_name, ${shownName("e")} AS name, e.title, e.title_of_courtesy,
  e.reports_to, ${shownName("m")} AS manager_name, e.hire_date, e.city, e.country,
  e.user_id IS NOT NULL AS is_rep,
  coalesce(t.order_count, 0) AS order_count, coalesce(t.revenue, 0) AS revenue_dollars`;

const FROM = `
  employees e
  LEFT JOIN employees m ON m.employee_id = e.reports_to
  LEFT JOIN (SELECT employee_id, count(*) AS order_count, round(sum(lines_total), 2) AS revenue
             FROM orders GROUP BY employee_id) t ON t.employee_id = e.employee_id`;

const toEmployee = (row: Record<string, unknown>) =>
  schemas.employee.parse({ ...row, is_rep: bool(row.is_rep) });

export function readEmployee(db: AppEnv["Variables"]["db"], employeeId: number, viewer: Viewer) {
  const sql = `SELECT ${SELECT} FROM ${FROM} WHERE e.employee_id = :employee_id`;
  const row = db.prepare(sql).get(usedBy(sql, { ...viewer, employee_id: employeeId }));
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
        { ...viewerOf(c) },
        q.page,
        q.per_page,
        toEmployee,
      );
      return c.json(page);
    },
  )
  .get("/directory", (c) => {
    const sql = `SELECT employee_id, ${shownName("e")} AS name, title, reports_to FROM employees e
                 ORDER BY employee_id LIMIT :limit`;
    const rows = c.var.db.prepare(sql).all(usedBy(sql, { ...viewerOf(c), limit: MAX_DIRECTORY }));
    return c.json(schemas.directory.parse(rows));
  })
  .get("/:id{[0-9]+}", (c) => {
    const id = Number(c.req.param("id"));
    const found = readEmployee(c.var.db, id, viewerOf(c));
    if (!found) return c.json(notFound(`employee ${id}`), 404);
    const territories = c.var.db
      .prepare(
        `SELECT t.territory_id, t.name, r.name AS region
         FROM employee_territories et JOIN territories t USING (territory_id) JOIN regions r USING (region_id)
         WHERE et.employee_id = ? ORDER BY t.territory_id`,
      )
      .all(id);
    // Personal details are read only for someone signed in, so a visitor's
    // response never holds them, and that response may be cached.
    const personal = c.var.user
      ? c.var.db
          .prepare(
            `SELECT birth_date, address, region, postal_code, home_phone, extension, notes,
               photo IS NOT NULL AS has_photo
             FROM employees WHERE employee_id = ?`,
          )
          .get(id)
      : undefined;
    return c.json(
      schemas.employeeDetail.parse({
        ...found,
        territories,
        personal: personal ? { ...personal, has_photo: bool(personal.has_photo) } : null,
      }),
    );
  })
  .get("/:id{[0-9]+}/photo", requireUser, (c) => {
    const row = c.var.db
      .prepare("SELECT photo FROM employees WHERE employee_id = ?")
      .get(Number(c.req.param("id")));
    if (!row?.photo) return c.json(notFound(`photo of employee ${c.req.param("id")}`), 404);
    return c.body(row.photo as Uint8Array<ArrayBuffer>, 200, { "Content-Type": "image/jpeg" });
  });
