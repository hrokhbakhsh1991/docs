import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceRuleCell } from "@app-tour/workspace-sdk/registry";

import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { pickBestMatchingCell } from "../../../src/engine/rule-resolution.js";

const ambiguousPair = (order: "z-first" | "a-first"): readonly WorkspaceRuleCell[] => {
  const zLast: WorkspaceRuleCell = {
    cellId: "z-last",
    dimensions: { variant: "x" },
    fieldOverrides: [],
  };
  const aFirst: WorkspaceRuleCell = {
    cellId: "a-first",
    dimensions: { variant: "x" },
    fieldOverrides: [],
  };
  return order === "z-first" ? [zLast, aFirst] : [aFirst, zLast];
};

function assertAmbiguousThrow(
  matches: readonly WorkspaceRuleCell[],
  dimensions: Readonly<Record<string, string>>,
): PlatformCoreError {
  try {
    pickBestMatchingCell(matches, dimensions);
    assert.fail("expected AMBIGUOUS_RULE_RESOLUTION");
  } catch (error: unknown) {
    assert.ok(error instanceof PlatformCoreError);
    return error;
  }
}

/**
 * Docs: docs/phase-1/subphases/1.3-rule-engine.md + phase-1-platform-core §4.3
 * — highest matched dimension key count, then higher priority; tie → AMBIGUOUS (no lexicographic winner).
 */
describe("pickBestMatchingCell — specificity and ambiguous resolution", () => {
  it("picks higher specificity before priority (doc step: most matched keys wins)", () => {
    const matches: readonly WorkspaceRuleCell[] = [
      {
        cellId: "catch-all",
        dimensions: {},
        priority: 100,
        fieldOverrides: [],
      },
      {
        cellId: "specific",
        dimensions: { variant: "premium", tier: "gold" },
        priority: 1,
        fieldOverrides: [],
      },
    ];
    const winner = pickBestMatchingCell(matches, { variant: "premium", tier: "gold" });
    assert.equal(winner.cellId, "specific");
  });

  it("throws AMBIGUOUS_RULE_RESOLUTION on equal specificity and priority — no lexicographic winner", () => {
    const dimensions = { variant: "x" };
    const error = assertAmbiguousThrow(ambiguousPair("z-first"), dimensions);
    assert.equal(error.code, "AMBIGUOUS_RULE_RESOLUTION");
    assert.equal(error.details?.specificity, 1);
    assert.equal(error.details?.priority, 0);
    assert.deepEqual(error.details?.tiedCellIds, ["z-last", "a-first"]);
  });

  it("ambiguous tie does not pick a-first when match array order is reversed", () => {
    const dimensions = { variant: "x" };
    const error = assertAmbiguousThrow(ambiguousPair("a-first"), dimensions);
    assert.equal(error.code, "AMBIGUOUS_RULE_RESOLUTION");
    assert.deepEqual(error.details?.tiedCellIds, ["a-first", "z-last"]);
  });

  it("resolution is deterministic across 200 re-runs (no Non-Deterministic Engine Flaw)", () => {
    const dimensions = { variant: "x" };
    const signatures = new Set<string>();

    for (let run = 0; run < 200; run += 1) {
      const error = assertAmbiguousThrow(ambiguousPair("z-first"), dimensions);
      signatures.add(
        JSON.stringify({
          code: error.code,
          tiedCellIds: error.details?.tiedCellIds,
          specificity: error.details?.specificity,
          priority: error.details?.priority,
        }),
      );
    }

    assert.equal(
      signatures.size,
      1,
      `expected identical ambiguity outcome on every run, got ${signatures.size} distinct signatures`,
    );
  });

  it("specificity then priority: higher priority wins only when specificity is tied", () => {
    const matches: readonly WorkspaceRuleCell[] = [
      {
        cellId: "low-priority-catch-all",
        dimensions: {},
        priority: 1,
        fieldOverrides: [],
      },
      {
        cellId: "high-priority-catch-all",
        dimensions: {},
        priority: 10,
        fieldOverrides: [],
      },
    ];
    const winner = pickBestMatchingCell(matches, { variant: "orphan" });
    assert.equal(winner.cellId, "high-priority-catch-all");
  });
});
