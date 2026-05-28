import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/app", replacement: path.resolve(__dirname, "app") },
      { find: "@/lib", replacement: path.resolve(__dirname, "lib") },
      { find: "@/", replacement: `${path.resolve(__dirname, "src")}/` },
    ],
  },
  test: {
    environment: "node",
  },
});
