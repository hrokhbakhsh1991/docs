import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PLATFORM_PREFIX, tryDispatchPlatformRoutes } from "../src/http/platform-route-registrar.ts";

describe("platform-route-registrar", () => {
  it("contains prefix - PLATFORM_PREFIX is /platform/v1", () => {
    assert.strictEqual(PLATFORM_PREFIX, "/platform/v1", "Should have correct platform prefix");
  });

  it("exports fn - tryDispatchPlatformRoutes is a function", () => {
    assert.strictEqual(typeof tryDispatchPlatformRoutes, "function", "Should export tryDispatchPlatformRoutes function");
  });

  it("registers workspace definition publish routes", () => {
    const source = readFileSync(new URL("../src/http/platform-route-registrar.ts", import.meta.url), "utf8");
    assert.match(source, /WORKSPACE_DEFINITION_VERSION_GET_PATTERN/);
    assert.match(source, /WORKSPACE_DEFINITION_VERSIONS_POST_PATTERN/);
    assert.match(source, /handlePlatformWorkspaceDefinitionsPost/);
    assert.match(source, /handlePlatformWorkspaceDefinitionsVersionsPost/);
    assert.match(source, /handlePlatformWorkspaceDefinitionsVersionGet/);
  });
});
