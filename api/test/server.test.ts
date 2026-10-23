import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const entry = join(import.meta.dirname, "../src/server.ts");
let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function freePort() {
  return new Promise<number>((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

describe("the production server", () => {
  // In a container the server is process 1, which the kernel never stops on a
  // signal it does not handle, so a stop would wait and then kill it.
  it.each(["SIGTERM", "SIGINT"] as const)("exits cleanly on %s", async (signal) => {
    dir = mkdtempSync(join(tmpdir(), "oim-shop-server-"));
    const child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        DATABASE_PATH: join(dir, "shop.db"),
        PORT: String(await freePort()),
        HOST: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    await new Promise<void>((resolve) =>
      child.stdout.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("listening")) resolve();
      }),
    );
    child.kill(signal);
    const [code, endedBy] = await new Promise<[number | null, string | null]>((resolve) =>
      child.on("exit", (exitCode, exitSignal) => resolve([exitCode, exitSignal])),
    );
    expect({ code, endedBy }).toEqual({ code: 0, endedBy: null });
  });
});
