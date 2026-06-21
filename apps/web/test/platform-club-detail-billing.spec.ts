import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("platform club detail billing", () => {
  it("tab-billing has required data attributes and no denali/ui", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/club-detail/tab-billing.tsx"),
      "utf8"
    );
    assert.match(source, /data-tab="billing"/);
    assert.match(source, /data-billing-mark-paid/);
    assert.doesNotMatch(source, /denali\/ui/);
  });
});
