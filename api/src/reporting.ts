// Who each signed-in person reports to. A rep reports to the first manager
// who signed in, or to Steven Buchanan (5), Northwind's Sales Manager, until
// one has; a manager reports to Andrew Fuller (2), Vice President, Sales.
// Northwind's own employees keep the lines the source gives them.
import type { Database } from "./db.ts";

export const NORTHWIND_SALES_MANAGER = 5;
export const NORTHWIND_VICE_PRESIDENT = 2;

/** Sets every account's title and manager from its role. Running it twice changes nothing. */
export function assignReporting(db: Database) {
  db.prepare(
    `UPDATE employees SET
       title = CASE u.role WHEN 'manager' THEN 'Sales Manager' ELSE 'Sales Representative' END,
       reports_to = CASE u.role
         WHEN 'manager' THEN :vice_president
         ELSE coalesce(
           (SELECT m.employee_id FROM employees m JOIN users mu USING (user_id)
            WHERE mu.role = 'manager' ORDER BY mu.manager_since, m.employee_id LIMIT 1),
           :sales_manager)
       END
     FROM users u WHERE u.user_id = employees.user_id`,
  ).run({ vice_president: NORTHWIND_VICE_PRESIDENT, sales_manager: NORTHWIND_SALES_MANAGER });
}
