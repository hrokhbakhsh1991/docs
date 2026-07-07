import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("lazy-route-handlers platform import", () => {
  it("contains routes/platform - lazy-route-handlers imports platform routes", () => {
    const filePath = join(process.cwd(), "src/boot/lazy-route-handlers.ts");
    const content = readFileSync(filePath, "utf8");

    assert.ok(
      content.includes('import("../routes/platform/workspaces")'),
      "Should contain lazy import for routes/platform/workspaces"
    );
  });
});

// Made with Bob
