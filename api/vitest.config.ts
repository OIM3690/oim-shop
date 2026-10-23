import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // The suites share one machine; they each copy the seeded template file.
    fileParallelism: false,
  },
});
