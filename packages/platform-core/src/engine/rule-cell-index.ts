import type { WorkspaceRuleCell, WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import { MAX_RULE_CELL_INDEX_SIZE } from "./rule-cell-limits";
import { cellMatchesDimensions } from "./rule-resolution";

export { MAX_RULE_CELL_INDEX_SIZE } from "./rule-cell-limits";

export type DimensionSignature = string;

/**
 * Builds a dimension signature using a pre-sorted key order (no per-call localeCompare).
 */
export function buildDimensionSignature(
  dimensions: Readonly<Record<string, string>>,
  sortedKeyOrder: readonly string[],
): DimensionSignature {
  const parts: string[] = [];
  for (const key of sortedKeyOrder) {
    const value = dimensions[key];
    if (value !== undefined) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join("|");
}

/**
 * Stable dimension key for hash buckets (cold path / tests without precomputed order).
 */
export function dimensionSignature(dimensions: Readonly<Record<string, string>>): DimensionSignature {
  const keys = Object.keys(dimensions);
  keys.sort((a, b) => a.localeCompare(b));
  return buildDimensionSignature(dimensions, keys);
}

/**
 * Bounded rule-cell lookup: scans only cells whose dimension key-count is <= context key-count,
 * plus exact-signature buckets for O(1) catch-all and full-match hits.
 */
export class RuleCellIndex {
  private readonly sortedDimensionKeys: readonly string[];
  private readonly exactBuckets = new Map<DimensionSignature, WorkspaceRuleCell[]>();
  private readonly cellsByDimensionKeyCount = new Map<number, WorkspaceRuleCell[]>();
  private readonly matchScratch: WorkspaceRuleCell[] = [];
  private readonly matchSeenScratch = new Set<string>();

  constructor(ruleSet: WorkspaceRuleSet) {
    if (ruleSet.cells.length > MAX_RULE_CELL_INDEX_SIZE) {
      throw new PlatformCoreError(
        "INVALID_RULE_SET",
        `ruleSet.cells exceeds rule cell index limit (${MAX_RULE_CELL_INDEX_SIZE})`,
        { cellCount: ruleSet.cells.length },
      );
    }

    this.sortedDimensionKeys = [...ruleSet.matrixDimensions].sort((a, b) => a.localeCompare(b));

    for (const cell of ruleSet.cells) {
      const signature = this.signatureFor(cell.dimensions);
      const exactList = this.exactBuckets.get(signature) ?? [];
      exactList.push(cell);
      this.exactBuckets.set(signature, exactList);

      const keyCount = Object.keys(cell.dimensions).length;
      const countList = this.cellsByDimensionKeyCount.get(keyCount) ?? [];
      countList.push(cell);
      this.cellsByDimensionKeyCount.set(keyCount, countList);
    }
  }

  signatureFor(dimensions: Readonly<Record<string, string>>): DimensionSignature {
    return buildDimensionSignature(dimensions, this.sortedDimensionKeys);
  }

  /**
   * Returns matching cells in a reusable scratch buffer — consume synchronously before the next call.
   * @param maxDimensionKeys — upper bound from matrixDimensions.length (prevents key-count DoS).
   */
  findMatches(
    dimensions: Readonly<Record<string, string>>,
    maxDimensionKeys: number,
  ): readonly WorkspaceRuleCell[] {
    const contextKeyCount = Object.keys(dimensions).length;
    const upper = Math.min(contextKeyCount, maxDimensionKeys);
    const matches = this.matchScratch;
    matches.length = 0;
    this.matchSeenScratch.clear();

    const appendFromBucket = (bucket: readonly WorkspaceRuleCell[] | undefined): void => {
      if (!bucket) {
        return;
      }
      for (const cell of bucket) {
        if (this.matchSeenScratch.has(cell.cellId)) {
          continue;
        }
        if (cellMatchesDimensions(cell, dimensions)) {
          this.matchSeenScratch.add(cell.cellId);
          matches.push(cell);
        }
      }
    };

    appendFromBucket(this.exactBuckets.get(this.signatureFor(dimensions)));

    for (let keyCount = 0; keyCount <= upper; keyCount += 1) {
      if (keyCount === contextKeyCount) {
        continue;
      }
      appendFromBucket(this.cellsByDimensionKeyCount.get(keyCount));
    }

    return matches;
  }

  /**
   * Exact signature bucket (O(1)); does not include partial-dimension cells unless signature matches.
   */
  findExactBucket(dimensions: Readonly<Record<string, string>>): readonly WorkspaceRuleCell[] {
    return this.exactBuckets.get(this.signatureFor(dimensions)) ?? [];
  }
}
