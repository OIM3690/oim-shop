// Serves /api/* from Hono and, when webDist is set, the built web app next to
// it, so the page and the API share one origin.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, type AppOptions } from "./app.ts";

export interface ServeOptions extends AppOptions {
  port: number;
  host: string;
  webDist?: string;
  /** Where the access log goes; the container's standard output, by default. */
  log?: (line: string) => void;
}

export function startServer({ port, host, webDist, log = console.log, ...appOptions }: ServeOptions) {
  const site = new Hono();
  // One line per request: method, path, status and time. No query string and
  // no client address, so the log holds nothing about who asked.
  site.use(async (c, next) => {
    const start = performance.now();
    await next();
    log(`${c.req.method} ${c.req.path} ${c.res.status} ${Math.round(performance.now() - start)}ms`);
  });
  site.route("/", createApp(appOptions));
  if (webDist) {
    const indexHtml = readFileSync(join(webDist, "index.html"), "utf8");
    site.use("/*", serveStatic({ root: webDist }));
    // Any other path is a page of the single-page app, such as /orders/10248.
    site.get("*", (c) => c.html(indexHtml));
  }
  return serve({ fetch: site.fetch, port, hostname: host }, (info) => {
    console.log(`oim-shop listening on http://${info.address}:${info.port}`);
  });
}
