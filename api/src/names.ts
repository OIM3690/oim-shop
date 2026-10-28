// The name each viewer may see for a person. Northwind's employees keep their
// real names. A rep's chosen name is seen only by that rep and the managers,
// and a manager's by everyone signed in; anyone else sees "Sales rep 12" or
// "Sales manager 10", after the employee number. The SQL below is used in
// SELECT and in ORDER BY alike, so sorting by name reveals nothing either.
import type { Context } from "hono";
import type { AppEnv } from "./app.ts";

/** The parameters every query that shows a name needs: who is looking. */
export interface Viewer {
  viewer_role: "rep" | "manager" | null;
  viewer_employee: number | null;
}

export function viewerOf(c: Context<AppEnv>): Viewer {
  const user = c.var.user;
  return { viewer_role: user?.role ?? null, viewer_employee: user?.employee_id ?? null };
}

/** SQL for the name a viewer may see of employee `alias`. */
export const shownName = (alias: string) => `
  CASE
    WHEN ${alias}.user_id IS NULL THEN trim(${alias}.first_name || ' ' || ${alias}.last_name)
    WHEN ${alias}.employee_id = :viewer_employee OR :viewer_role = 'manager' THEN ${alias}.first_name
    WHEN (SELECT role FROM users WHERE user_id = ${alias}.user_id) = 'manager'
      THEN CASE WHEN :viewer_role IS NOT NULL THEN ${alias}.first_name ELSE 'Sales manager ' || ${alias}.employee_id END
    ELSE 'Sales rep ' || ${alias}.employee_id
  END`;
