import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

const ALLOWED_FIELD_KINDS = new Set(["text", "enum", "boolean"]);

describe("starter workspace field kinds (3.3.x)", () => {
  it("registry uses only allowed field kinds", () => {
    const { fieldRegistry } = getStarterWorkspacePlugin();
    for (const field of fieldRegistry.fields) {
      assert.ok(ALLOWED_FIELD_KINDS.has(field.kind), `field ${field.id} kind ${field.kind}`);
    }
  });
});
