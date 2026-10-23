// npm run sync: pulls new orders from oim-api. A timer runs it every hour.
import { bostonNow } from "../clock.ts";
import { config } from "../config.ts";
import { openDatabase } from "../db.ts";
import { syncOrders } from "../sync.ts";

const result = await syncOrders(openDatabase(config.databasePath), {
  apiBase: config.oimApiBase,
  now: bostonNow(),
});
console.log(`Sync: ${result.added} new orders, ${result.shipped} newly shipped.`);
