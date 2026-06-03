import type { WorkspaceRuleCell } from "@app-tour/workspace-sdk/registry";

import { PlatformCoreError } from "../errors/platform-core.error";
import { MAX_RULE_CELL_INDEX_SIZE } from "./rule-cell-limits";

export function cellMatchesDimensions(
  cell: WorkspaceRuleCell,
  dimensions: Readonly<Record<string, string>>,
): boolean {
  const cellDimensions = cell.dimensions;
  for (const key of Object.keys(cellDimensions)) {
    const cellValue = cellDimensions[key]!.normalize("NFC");
    const contextValue = dimensions[key]?.normalize("NFC");
    if (contextValue !== cellValue) {
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
    const cellValue = cellDimensions[key]!.normalize("NFC");
    const contextValue = dimensions[key]?.normalize("NFC");
    if (contextValue === cellValue) {
      count += 1;
    }
  }
  return count;
}

type MatchScratchPool = {
  readonly spec: Uint16Array;
  readonly priority: Int16Array;
};

/**
 * Allocates isolated scratch buffers per call — safe across concurrent workers.
 */
export function createScratchPool(size: number = MAX_RULE_CELL_INDEX_SIZE): MatchScratchPool {
  return {
    spec: new Uint16Array(size),
    priority: new Int16Array(size),
  };
}

type DominantMatchResult = {
  readonly bestIndex: number;
  readonly bestSpec: number;
  readonly bestPriority: number;
  readonly tieCount: number;
};

function findDominantMatchIndex(
  matches: readonly WorkspaceRuleCell[],
  dimensions: Readonly<Record<string, string>>,
  specScratch: Uint16Array,
  priorityScratch: Int16Array,
): DominantMatchResult {
  const count = matches.length;

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

  return { bestIndex, bestSpec, bestPriority, tieCount };
}

function throwAmbiguousRuleResolution(
  matches: readonly WorkspaceRuleCell[],
  dimensions: Readonly<Record<string, string>>,
  bestSpec: number,
  bestPriority: number,
): never {
  const tiedCellIds: string[] = [];
  for (const cell of matches) {
    const spec = matchedDimensionKeyCount(cell, dimensions);
    const priority = cell.priority ?? 0;
    if (spec === bestSpec && priority === bestPriority) {
      tiedCellIds.push(cell.cellId);
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

  const { spec: specScratch, priority: priorityScratch } = createScratchPool(count);
  const dominant = findDominantMatchIndex(matches, dimensions, specScratch, priorityScratch);

  if (dominant.tieCount > 1) {
    throwAmbiguousRuleResolution(
      matches,
      dimensions,
      dominant.bestSpec,
      dominant.bestPriority,
    );
  }

  return matches[dominant.bestIndex]!;
}

export function isEmptyRuleDimensions(
  dimensions: Readonly<Record<string, string>>,
): boolean {
  return Object.keys(dimensions).length === 0;
}
