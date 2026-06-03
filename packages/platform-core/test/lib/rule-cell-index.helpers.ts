import type { WorkspaceRuleCell } from "@app-tour/workspace-sdk/registry";

import {
  buildDimensionSignature,
  RuleCellIndex,
  type DimensionSignature,
} from "../../src/engine/rule-cell-index.js";

export function dimensionSignature(
  dimensions: Readonly<Record<string, string>>,
): DimensionSignature {
  const keys = Object.keys(dimensions);
  keys.sort((a, b) => a.localeCompare(b));
  return buildDimensionSignature(dimensions, keys);
}

/** Exact-signature bucket lookup — test helper (production uses findMatches only). */
export function findExactSignatureCells(
  index: RuleCellIndex,
  dimensions: Readonly<Record<string, string>>,
): readonly WorkspaceRuleCell[] {
  const targetSig = index.signatureFor(dimensions);
  return index
    .findMatches(dimensions, Object.keys(dimensions).length)
    .filter((cell) => index.signatureFor(cell.dimensions) === targetSig);
}
