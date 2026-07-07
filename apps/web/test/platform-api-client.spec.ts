import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { platformBffPath } from "../src/platform/platform-api-client";

describe("platform-api-client", () => {
  it("/api/platform base", () => {
    assert.equal(platformBffPath("/tenants"), "/api/platform/tenants");
    assert.match(platformBffPath("workspaces"), /^\/api\/platform\//);
  });
});
