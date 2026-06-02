import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import { dimensionSignature, RuleCellIndex } from "./rule-cell-index";

const baseRuleSet: WorkspaceRuleSet = {
  version: 1,
  matrixDimensions: ["variant"],
  defaultCellId: "default",
  cells: [
    {
      cellId: "catch-all",
      dimensions: {},
      fieldOverrides: [],
    },
    {
      cellId: "premium",
      dimensions: { variant: "premium" },
      fieldOverrides: [],
    },
    {
      cellId: "default",
      dimensions: { variant: "default" },
      fieldOverrides: [],
    },
  ],
};

describe("RuleCellIndex", () => {
  it("dimensionSignature sorts keys deterministically", () => {
    assert.equal(
      dimensionSignature({ tier: "gold", variant: "premium" }),
      "tier=gold|variant=premium",
    );
  });

  it("findMatches returns partial-dimension and catch-all cells", () => {
    const index = new RuleCellIndex(baseRuleSet);
    const matches = index.findMatches({ variant: "premium", tier: "gold" }, 2);
    const ids = matches.map((cell) => cell.cellId).sort();
    assert.deepEqual(ids, ["catch-all", "premium"]);
  });

  it("findExactBucket returns only exact signature cells", () => {
    const index = new RuleCellIndex(baseRuleSet);
    const exact = index.findExactBucket({ variant: "default" });
    assert.equal(exact.length, 1);
    assert.equal(exact[0]?.cellId, "default");
  });

  it("throws CARDINALITY_VIOLATION when cell count exceeds index limit", () => {
    const cells = Array.from({ length: 257 }, (_, i) => ({
      cellId: `cell-${i}`,
      dimensions: { variant: `v-${i}` },
      fieldOverrides: [],
    }));
    assert.throws(
      () =>
        new RuleCellIndex({
          version: 1,
          matrixDimensions: ["variant"],
          defaultCellId: "cell-0",
          cells,
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CARDINALITY_VIOLATION");
        return true;
      },
    );
  });
});
