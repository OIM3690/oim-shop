import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startServer, type ServeOptions } from "../src/serve.ts";
import { freshDb, TEST_NOW } from "./helpers.ts";

const PAGE = "<!doctype html><html><head><title>Northwind Sales</title></head><body></body></html>";

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
