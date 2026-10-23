import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startServer, type ServeOptions } from "../src/serve.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";

const PAGE = "<!doctype html><html><head><title>Northwind Sales</title></head><body></body></html>";
const ANALYTICS = {
  scriptUrl: "https://stats.example.com/script.js",
  websiteId: "0b7f4c1e-0000-4000-8000-000000000000",
};

let dir = "";
let stop = () => {};
afterEach(() => {
  stop();
  rmSync(dir, { recursive: true, force: true });
});

/** Starts the real server on a free port, with a stand-in web build, and records what it logs. */
async function serveSite(options: Partial<ServeOptions> = {}) {
  dir = mkdtempSync(join(tmpdir(), "oim-shop-serve-"));
  writeFileSync(join(dir, "index.html"), PAGE);
  const lines: string[] = [];
  const server = startServer({
    db: freshDb(),
    now: () => TEST_NOW,
    publicUrl: "https://shop.example.com",
    port: 0,
    host: "127.0.0.1",
    webDist: dir,
    log: (line) => lines.push(line),
    ...options,
  });
  await new Promise((resolve) => server.once("listening", resolve));
  stop = () => server.close();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { lines, get: (path: string) => fetch(base + path) };
}

describe("the access log", () => {
  it("writes one line per request, with the path but not the query or the address", async () => {
    const { lines, get } = await serveSite();
    await get("/api/health?name=Ana%20Ruiz");
    await get("/orders/10248");
    expect(lines).toEqual([
      expect.stringMatching(/^GET \/api\/health 200 \d+ms$/),
      expect.stringMatching(/^GET \/orders\/10248 200 \d+ms$/),
    ]);
    expect(lines.join("\n")).not.toMatch(/Ana|127\.0\.0\.1/);
  });
});

describe("page analytics", () => {
  it("adds the Umami tag to every page when the server is set up for it", async () => {
    const { get } = await serveSite({ analytics: ANALYTICS });
    for (const path of ["/", "/orders/10248"]) {
      const html = await (await get(path)).text();
      expect(html).toContain(
        `<script defer src="${ANALYTICS.scriptUrl}" data-website-id="${ANALYTICS.websiteId}" data-domains="shop.example.com" data-exclude-search="true"></script></head>`,
      );
    }
  });

  it("adds nothing without it, as on your own machine or a fork", async () => {
    const { get } = await serveSite();
    expect(await (await get("/")).text()).toBe(PAGE);
  });
});
