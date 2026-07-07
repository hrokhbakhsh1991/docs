import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("platform-workspace-definition-tab", () => {
  it("TA-01 tab marker present in component source", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/club-detail/tab-workspace-definition.tsx"),
      "utf8"
    );
    assert.match(source, /data-tab="workspace-definition"/);
  });

  it("TA-02 PATCH path includes tenants workspace-definition", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/club-detail/tab-workspace-definition.tsx"),
      "utf8"
    );
    assert.match(source, /\/tenants\/\$\{tenantId\}\/workspace-definition/);
  });

  it("TA-03 assign button disabled when write role false", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/club-detail/tab-workspace-definition.tsx"),
      "utf8"
    );
    assert.match(source, /disabled=\{!isWriteRole \|\| busy\}/);
    assert.match(source, /isWriteRole/);
  });
});
