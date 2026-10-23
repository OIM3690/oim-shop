// npm run dev: the API server and the Vite dev server together, one command.
// Vite serves the pages at http://localhost:5173 and forwards /api to the API
// on port 8787, so the browser sees one origin, as in production. Stop both
// with Ctrl+C.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const db = new URL("../api/shop.db", import.meta.url);

if (!existsSync(db)) {
  console.log("No database yet; seeding api/shop.db first.");
  const seed = spawn(npm, ["run", "seed", "--workspace", "api"], { stdio: "inherit", shell: process.platform === "win32" });
  const code: number = await new Promise((resolve) => seed.on("exit", (c) => resolve(c ?? 1)));
  if (code !== 0) process.exit(code);
}

const children = [
  spawn(npm, ["run", "dev", "--workspace", "api"], { stdio: "inherit", shell: process.platform === "win32" }),
  spawn(npm, ["run", "dev", "--workspace", "web"], { stdio: "inherit", shell: process.platform === "win32" }),
];
const stop = () => children.forEach((child) => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((child) => child.on("exit", stop));
