import path from "node:path";
import { defineConfig } from "vitest/config";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [viteTsconfigPaths()],
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: [
      { find: "@/app", replacement: path.resolve(__dirname, "app") },
      { find: "@/lib", replacement: path.resolve(__dirname, "lib") },
      { find: "@/", replacement: `${path.resolve(__dirname, "src")}/` },
    ],
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/**/*.spec.ts",
      "tests/**/*.spec.tsx",
      "src/hooks/**/*.spec.tsx",
      "src/features/tours/wizard/**/__tests__/guards/**/*.guard.test.ts",
    ],
    setupFiles: ["./tests/vitest.setup.ts"],
  },
});
