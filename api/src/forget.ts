// The end-of-term cleanup: every rep's account, chosen name, sessions and
// employee record go, with every order entered on the site, and stock
// returns to the seed. Managers keep their accounts and names, so next
// term's reps report to the same manager.
import { transaction, type Database } from "./db.ts";
import { assignReporting } from "./reporting.ts";
import { removeEnteredOrders } from "./reset.ts";

export function forgetAccounts(db: Database) {
  return transaction(db, () => {
    const { ordersRemoved } = removeEnteredOrders(db);
    db.exec("DELETE FROM employees WHERE user_id IN (SELECT user_id FROM users WHERE role = 'rep')");
    // Sessions go with their accounts (ON DELETE CASCADE).
    const accountsRemoved = Number(db.prepare("DELETE FROM users WHERE role = 'rep'").run().changes);
    assignReporting(db);
    return { accountsRemoved, ordersRemoved };
  });
}
