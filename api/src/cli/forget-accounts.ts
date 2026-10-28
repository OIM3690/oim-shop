// npm run forget-accounts: the end-of-term cleanup. Removes every rep's
// account and every entered order; managers stay.
import { config } from "../config.ts";
import { openDatabase } from "../db.ts";
import { forgetAccounts } from "../forget.ts";

const result = forgetAccounts(openDatabase(config.databasePath));
console.log(
  `Forgot ${result.accountsRemoved} rep accounts and ${result.ordersRemoved} entered orders; managers kept.`,
);
