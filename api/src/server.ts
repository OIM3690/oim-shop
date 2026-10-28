// The production entry point: settings from the environment, then serve.
import { bostonNow } from "./clock.ts";
import { config } from "./config.ts";
import { openDatabase } from "./db.ts";
import { startServer } from "./serve.ts";

const db = openDatabase(config.databasePath);
const server = startServer({
  db,
  now: () => bostonNow(),
  publicUrl: config.publicUrl,
  github: config.github,
  allowedUsersFile: config.allowedUsersFile,
  clientIpHeader: config.clientIpHeader,
  port: config.port,
  host: config.host,
  webDist: config.webDist || undefined,
  analytics: config.analytics,
});

// In the container this is process 1, which ignores a signal it does not
// handle, so `podman stop` would wait and then kill it. Finish the requests in
// flight, close the database, and exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
