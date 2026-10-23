// Serves /api/* from Hono and, when webDist is set, the built web app next to
// it, so the page and the API share one origin.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, type AppOptions } from "./app.ts";

export interface ServeOptions extends AppOptions {
  port: number;
  host: string;
  webDist?: string;
}

export function startServer({ port, host, webDist, ...appOptions }: ServeOptions) {
  const app = createApp(appOptions);
  if (webDist) {
    const indexHtml = readFileSync(join(webDist, "index.html"), "utf8");
    app.use("/*", serveStatic({ root: webDist }));
    // Any other path is a page of the single-page app, such as /orders/10248.
    app.get("*", (c) => c.html(indexHtml));
  }
  return serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.log(`oim-shop listening on http://${info.address}:${info.port}`);
  });
}
