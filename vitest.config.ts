import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Vite 5 doesn't know the Node 24 builtin and strips the `node:` prefix.
      "node:sqlite": path.resolve(__dirname, "tests/node-sqlite-shim.mjs"),
      sqlite: path.resolve(__dirname, "tests/node-sqlite-shim.mjs"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
