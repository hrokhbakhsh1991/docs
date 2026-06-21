import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listPlatformWorkspaces } from "../src/platform/list-platform-workspaces.ts";

describe("listPlatformWorkspaces", () => {
  it("id denali", () => {
    const r = listPlatformWorkspaces();
    const ids = r.map((x) => x.id);
    assert.ok(ids.includes("denali"));
  });

  it("types array", () => {
    const r = listPlatformWorkspaces();
    assert.equal(Array.isArray(r[0].types), true);
  });
});
