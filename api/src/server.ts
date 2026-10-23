// Starts the app: /api/* from Hono, and in production the built web app
// next to it, so the page and the API share one origin.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { bostonNow } from "./clock.ts";
import { config } from "./config.ts";
import { openDatabase } from "./db.ts";

const app = createApp({
  db: openDatabase(config.databasePath),
  now: () => bostonNow(),
  publicUrl: config.publicUrl,
  github: config.github,
  clientIpHeader: config.clientIpHeader,
});

if (config.webDist) {
  const indexHtml = readFileSync(join(config.webDist, "index.html"), "utf8");
  app.use("/*", serveStatic({ root: config.webDist }));
  // Any other path is a page of the single-page app, such as /orders/10248.
  app.get("*", (c) => c.html(indexHtml));
}

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`oim-shop listening on http://${info.address}:${info.port}`);
});
