import { copyFileSync, mkdirSync } from "node:fs";
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

// v1 is one HTML file that needs no build, so GitHub Pages serves it as it is,
// beside v2, at /oim-shop/v1/.
function withV1(): Plugin {
  let outDir = "dist";
  return {
    name: "with-v1",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      mkdirSync(join(outDir, "v1"), { recursive: true });
      copyFileSync(
        fileURLToPath(new URL("../v1/index.html", import.meta.url)),
        join(outDir, "v1", "index.html"),
      );
    },
  };
}

// The site is served from a subpath on GitHub Pages; VITE_BASE overrides it.
const base = process.env.VITE_BASE ?? "/oim-shop/";

export default defineConfig({
  base,
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    spaFallback(),
    withV1(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
