// npm run seed: fills a new database from data/seed on oim-api's clock.
// It refuses to overwrite a database that already has orders, because that
// would also delete every account; pass --force to do it anyway.
import { z } from "zod";
import { bostonNow, DEFAULT_SHIFT_DAYS } from "../clock.ts";
import { config } from "../config.ts";
import { openDatabase } from "../db.ts";
import { loadSeed } from "../seed.ts";

const db = openDatabase(config.databasePath);
const existing = Number(db.prepare("SELECT count(*) AS n FROM orders").get()!.n);
if (existing > 0 && !process.argv.includes("--force")) {
  console.error(
    `${config.databasePath} already has ${existing} orders. Run with --force to replace everything.`,
  );
  process.exit(1);
}

let shiftDays = DEFAULT_SHIFT_DAYS;
try {
  const index = z
    .object({ clock_shift_days: z.number().int() })
    .parse(await (await fetch(config.oimApiBase)).json());
  shiftDays = index.clock_shift_days;
} catch {
  console.warn(`Could not read clock_shift_days from ${config.oimApiBase}; using ${DEFAULT_SHIFT_DAYS}.`);
}

const now = bostonNow();
loadSeed(db, { shiftDays, now });
const orders = Number(db.prepare("SELECT count(*) AS n FROM orders").get()!.n);
console.log(
  `Seeded ${config.databasePath}: ${orders} orders placed by ${now} (Boston), dates moved ${shiftDays} days.`,
);
