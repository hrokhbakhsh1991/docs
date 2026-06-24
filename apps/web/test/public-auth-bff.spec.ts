import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const webRoot = join(import.meta.dirname, "..");

function collectRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectRouteFiles(full);
    }
    return entry.name === "route.ts" ? [full] : [];
  });
}

describe("web public-auth removal — P9-1-N-001", () => {
  it("zero route.ts under app/api/public-auth", () => {
    assert.equal(collectRouteFiles(join(webRoot, "app/api/public-auth")).length, 0);
  });

  it("middleware does not whitelist web public-auth BFF", () => {
    const middleware = readFileSync(join(webRoot, "middleware.ts"), "utf8");
    assert.doesNotMatch(middleware, /\/api\/public-auth\//);
  });
});
