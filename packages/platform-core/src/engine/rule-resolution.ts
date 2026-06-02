import type { WorkspaceRuleCell } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import { MAX_RULE_CELL_INDEX_SIZE } from "./rule-cell-limits";

export function cellMatchesDimensions(
  cell: WorkspaceRuleCell,
  dimensions: Readonly<Record<string, string>>,
): boolean {
  const cellDimensions = cell.dimensions;
  for (const key of Object.keys(cellDimensions)) {
    if (dimensions[key] !== cellDimensions[key]) {
      return false;
    }
  }
  return true;
}

function matchedDimensionKeyCount(
  cell: WorkspaceRuleCell,
  dimensions: Readonly<Record<string, string>>,
): number {
  let count = 0;
  const cellDimensions = cell.dimensions;
  for (const key of Object.keys(cellDimensions)) {
    if (dimensions[key] === cellDimensions[key]) {
      count += 1;
    }
  }
  return count;
}

const specScratch = new Uint16Array(MAX_RULE_CELL_INDEX_SIZE);
const priorityScratch = new Int16Array(MAX_RULE_CELL_INDEX_SIZE);

/**
 * Pick the single best matching cell by specificity then priority.
 * Throws AMBIGUOUS_RULE_RESOLUTION when multiple cells tie — no alphabetical fallback.
 */
export function pickBestMatchingCell(
  matches: readonly WorkspaceRuleCell[],
  dimensions: Readonly<Record<string, string>>,
): WorkspaceRuleCell {
  const count = matches.length;
  if (count === 0) {
    throw new PlatformCoreError(
      "INVALID_RULE_SET",
      "pickBestMatchingCell requires at least one match",
    );
  }

  if (count === 1) {
    return matches[0]!;
  }

  if (count > MAX_RULE_CELL_INDEX_SIZE) {
    throw new PlatformCoreError(
      "INVALID_RULE_SET",
      `pickBestMatchingCell exceeds match pool limit (${MAX_RULE_CELL_INDEX_SIZE})`,
      { matchCount: count },
    );
  }

  for (let i = 0; i < count; i += 1) {
    specScratch[i] = matchedDimensionKeyCount(matches[i]!, dimensions);
    priorityScratch[i] = matches[i]!.priority ?? 0;
  }

  let bestIndex = 0;
  let bestSpec = specScratch[0]!;
  let bestPriority = priorityScratch[0]!;

  for (let i = 1; i < count; i += 1) {
    const spec = specScratch[i]!;
    const priority = priorityScratch[i]!;
    if (spec > bestSpec || (spec === bestSpec && priority > bestPriority)) {
      bestIndex = i;
      bestSpec = spec;
      bestPriority = priority;
    }
  }

  let tieCount = 0;
  for (let i = 0; i < count; i += 1) {
    if (specScratch[i] === bestSpec && priorityScratch[i] === bestPriority) {
      tieCount += 1;
    }
  }

  if (tieCount > 1) {
    const tiedCellIds: string[] = [];
    for (let i = 0; i < count; i += 1) {
      if (specScratch[i] === bestSpec && priorityScratch[i] === bestPriority) {
        tiedCellIds.push(matches[i]!.cellId);
      }
    }
    throw new PlatformCoreError(
      "AMBIGUOUS_RULE_RESOLUTION",
      `Ambiguous rule cell resolution for dimensions ${JSON.stringify(dimensions)}`,
      {
        dimensions,
        tiedCellIds,
        specificity: bestSpec,
        priority: bestPriority,
      },
    );
  }

  return matches[bestIndex]!;
}

export function isEmptyRuleDimensions(
  dimensions: Readonly<Record<string, string>>,
): boolean {
  return Object.keys(dimensions).length === 0;
}
