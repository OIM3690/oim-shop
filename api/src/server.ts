// The production entry point: settings from the environment, then serve.
import { bostonNow } from "./clock.ts";
import { config } from "./config.ts";
import { openDatabase } from "./db.ts";
import { startServer } from "./serve.ts";

startServer({
  db: openDatabase(config.databasePath),
  now: () => bostonNow(),
  publicUrl: config.publicUrl,
  github: config.github,
  clientIpHeader: config.clientIpHeader,
  port: config.port,
  host: config.host,
  webDist: config.webDist || undefined,
});
