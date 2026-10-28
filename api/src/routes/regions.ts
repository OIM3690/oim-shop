// Northwind's sales regions, their territories, and the employees who cover
// each territory. Only Northwind's own employees have territories.
import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import * as schemas from "../schemas.ts";

export const regions = new Hono<AppEnv>().get("/", (c) => {
  const db = c.var.db;
  const territories = db
    .prepare("SELECT territory_id, name, region_id FROM territories ORDER BY name, territory_id")
    .all();
  const covers = db
    .prepare(
      `SELECT et.territory_id, e.employee_id, trim(e.first_name || ' ' || e.last_name) AS name
       FROM employee_territories et JOIN employees e USING (employee_id) ORDER BY e.employee_id`,
    )
    .all();
  const body = db
    .prepare("SELECT region_id, name FROM regions ORDER BY region_id")
    .all()
    .map((region) => ({
      region_id: region.region_id,
      name: region.name,
      territories: territories
        .filter((t) => t.region_id === region.region_id)
        .map((t) => ({
          territory_id: t.territory_id,
          name: t.name,
          employees: covers
            .filter((e) => e.territory_id === t.territory_id)
            .map(({ employee_id, name }) => ({ employee_id, name })),
        })),
    }));
  return c.json(schemas.regions.parse(body));
});
