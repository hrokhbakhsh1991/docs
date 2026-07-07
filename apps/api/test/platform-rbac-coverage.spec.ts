import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("platform rbac coverage", () => {
  it("each POST uses guard", () => {
    const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/routes/platform");
    const files = readdirSync(routesDir).filter((name) => name.endsWith(".ts"));
    for (const file of files) {
      const source = readFileSync(path.join(routesDir, file), "utf8");
      if (!source.includes('method === "POST"') && !source.includes('req.method === "POST"')) {
        continue;
      }
      if (!source.includes("PATCH") && !source.includes("DELETE")) {
        if (source.includes('req.method === "POST"') || source.includes('method === "POST"')) {
          assert.match(source, /assertPlatformOpsWriteRole/, `${file} POST must use write guard`);
        }
      }
      if (source.includes("PATCH") || source.includes("DELETE")) {
        assert.match(source, /assertPlatformOpsWriteRole/, `${file} mutator must use write guard`);
      }
    }
  });
});
