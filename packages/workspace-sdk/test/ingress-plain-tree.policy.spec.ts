import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectPlainPrototype, sanitizePlainTree, policyPluginStorage } from "../src/ingress/plain-tree.js";

describe("plain-tree ingress policies", () => {
  it("inspectPlainPrototype returns NON_PLAIN_PROTOTYPE for null-prototype objects", () => {
    const exotic = Object.create(null) as object;
    const result = inspectPlainPrototype(exotic, "root");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "NON_PLAIN_PROTOTYPE");
    }
  });

  it("sanitizePlainTree rejects functions when allowFunctions is false", () => {
    assert.throws(
      () =>
        sanitizePlainTree(
          { fn: () => 1 },
          "root",
          policyPluginStorage({ allowFunctions: false }),
          (message) => {
            throw new Error(message);
          },
          true,
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(String(error), /Function is not allowed/);
        return true;
      },
    );
  });
});
