// Serves /api/* from Hono and, when webDist is set, the built web app next to
// it, so the page and the API share one origin.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, type AppOptions } from "./app.ts";

/** A self-hosted Umami: page views without cookies and without storing addresses. */
export interface Analytics {
  scriptUrl: string;
  websiteId: string;
}

export interface ServeOptions extends AppOptions {
  port: number;
  host: string;
  webDist?: string;
  /** Unset on your own machine and on a fork, so nothing is counted there. */
  analytics?: Analytics;
  /** Where the access log goes; the container's standard output, by default. */
  log?: (line: string) => void;
}

const attribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

/**
 * The Umami tag. It counts only visits to the site's own host, so a copy of
 * the page opened elsewhere is not counted, and it drops the query string,
 * which can hold what someone typed into a search box.
 */
function analyticsTag({ scriptUrl, websiteId }: Analytics, publicUrl: string) {
  return (
    `<script defer src="${attribute(scriptUrl)}" data-website-id="${attribute(websiteId)}"` +
    ` data-domains="${attribute(new URL(publicUrl).hostname)}" data-exclude-search="true"></script>`
  );
}

export function startServer({
  port,
  host,
  webDist,
  analytics,
  log = console.log,
  ...appOptions
}: ServeOptions) {
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
    let indexHtml = readFileSync(join(webDist, "index.html"), "utf8");
    if (analytics) {
      const publicUrl = appOptions.publicUrl ?? "http://localhost:5173";
      indexHtml = indexHtml.replace("</head>", `${analyticsTag(analytics, publicUrl)}</head>`);
    }
    // The page itself is answered here, before the static files, so "/" carries the tag too.
    site.get("/", (c) => c.html(indexHtml));
    site.get("/index.html", (c) => c.html(indexHtml));
    site.use("/*", serveStatic({ root: webDist }));
    // Any other path is a page of the single-page app, such as /orders/10248.
    site.get("*", (c) => c.html(indexHtml));
  }
  return serve({ fetch: site.fetch, port, hostname: host }, (info) => {
    console.log(`oim-shop listening on http://${info.address}:${info.port}`);
  });
}
