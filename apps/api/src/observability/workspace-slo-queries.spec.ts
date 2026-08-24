import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateWorkspaceSloQueryDefinitions,
  WORKSPACE_SLO_QUERY_DEFINITIONS,
} from "./workspace-slo-queries";

describe("workspace-slo-queries (MAT-012)", () => {
  it("defines bounded SLO burn queries per service area", () => {
    assert.ok(WORKSPACE_SLO_QUERY_DEFINITIONS.length >= 5);
    const areas = new Set(WORKSPACE_SLO_QUERY_DEFINITIONS.map((row) => row.area));
    assert.ok(areas.has("registration"));
    assert.ok(areas.has("publish_write"));
  });

  it("validates query syntax/config shape", () => {
    assert.deepEqual(validateWorkspaceSloQueryDefinitions(), []);
  });
});
