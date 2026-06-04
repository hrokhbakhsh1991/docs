import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

describe("starter workspace field kinds (P0-05)", () => {
  it("registry uses only text fields until Select/Checkbox ship", () => {
    const { fieldRegistry } = getStarterWorkspacePlugin();
    for (const field of fieldRegistry.fields) {
      assert.equal(field.kind, "text", `field ${field.id}`);
    }
  });
});
