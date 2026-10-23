import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// From v3 the app's own server serves the site at the root of its domain.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
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
