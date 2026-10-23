// npm run reset: puts entered orders and stock back to the seed. A timer runs it every night.
import { config } from "../config.ts";
import { openDatabase } from "../db.ts";
import { resetEnteredData } from "../reset.ts";

const result = resetEnteredData(openDatabase(config.databasePath));
console.log(`Reset: ${result.ordersRemoved} entered orders removed, stock restored.`);
