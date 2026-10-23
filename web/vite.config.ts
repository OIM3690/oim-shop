import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

// GitHub Pages answers an unknown path such as /oim-shop/orders/10248 with
// 404.html. A copy of index.html there starts the app, which then reads the
// path and shows the right page.
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "spa-fallback",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      copyFileSync(join(outDir, "index.html"), join(outDir, "404.html"));
    },
  };
}

// From v3 the app's own server serves the site at the root of its domain.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    spaFallback(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // In development, Vite serves the pages and forwards /api to the API server
  // (npm run dev starts both), so the browser sees one origin, as in production.
  server: {
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  test: {
    environment: "jsdom",
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    environmentOptions: { jsdom: { url: "http://localhost:3000/" } },
    // Each test file seeds nothing itself, but they share one small machine.
    fileParallelism: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
