import type { WorkspaceRuleCell, WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import { MAX_RULE_CELL_INDEX_SIZE } from "./rule-cell-limits";
import { cellMatchesDimensions } from "./rule-resolution";

export { MAX_RULE_CELL_INDEX_SIZE } from "./rule-cell-limits";

export type DimensionSignature = string;

function normalizeDimensionValue(value: string): string {
  return value.normalize("NFC");
}

/**
 * Deep-freezes an isolated copy of a rule cell so runtime plugin mutation cannot alter the index.
 */
function isolateRuleCell(cell: WorkspaceRuleCell): WorkspaceRuleCell {
  const dimensions: Record<string, string> = {};
  for (const [key, value] of Object.entries(cell.dimensions)) {
    dimensions[key] = value;
  }

  const fieldOverrides = cell.fieldOverrides.map((override) =>
    Object.freeze({
      fieldId: override.fieldId,
      ...(override.hidden != null ? { hidden: override.hidden } : {}),
      ...(override.required != null ? { required: override.required } : {}),
    }),
  );

  return Object.freeze({
    cellId: cell.cellId,
    dimensions: Object.freeze(dimensions),
    ...(cell.priority != null ? { priority: cell.priority } : {}),
    fieldOverrides: Object.freeze(fieldOverrides),
  });
}

/**
 * Builds a dimension signature using a pre-sorted key order (NFC-normalized values).
 */
export function buildDimensionSignature(
  dimensions: Readonly<Record<string, string>>,
  sortedKeyOrder: readonly string[],
): DimensionSignature {
  const parts: string[] = [];
  for (const key of sortedKeyOrder) {
    const value = dimensions[key];
    if (value !== undefined) {
      parts.push(`${key}=${normalizeDimensionValue(value)}`);
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

  constructor(ruleSet: WorkspaceRuleSet) {
    if (ruleSet.cells.length > MAX_RULE_CELL_INDEX_SIZE) {
      throw new PlatformCoreError(
        "CARDINALITY_VIOLATION",
        `ruleSet.cells exceeds maximum cardinality (${MAX_RULE_CELL_INDEX_SIZE})`,
        { cellCount: ruleSet.cells.length },
      );
    }

    this.sortedDimensionKeys = [...ruleSet.matrixDimensions].sort((a, b) => a.localeCompare(b));

    for (const cell of ruleSet.cells) {
      const isolated = isolateRuleCell(cell);
      const signature = this.signatureFor(isolated.dimensions);
      const exactList = this.exactBuckets.get(signature) ?? [];
      exactList.push(isolated);
      this.exactBuckets.set(signature, exactList);

      const keyCount = Object.keys(isolated.dimensions).length;
      const countList = this.cellsByDimensionKeyCount.get(keyCount) ?? [];
      countList.push(isolated);
      this.cellsByDimensionKeyCount.set(keyCount, countList);
    }
  }

  signatureFor(dimensions: Readonly<Record<string, string>>): DimensionSignature {
    return buildDimensionSignature(dimensions, this.sortedDimensionKeys);
  }

  /**
   * Returns a defensive clone of matching cells — safe to retain across async boundaries.
   * @param maxDimensionKeys — upper bound from matrixDimensions.length (prevents key-count DoS).
   */
  findMatches(
    dimensions: Readonly<Record<string, string>>,
    maxDimensionKeys: number,
  ): readonly WorkspaceRuleCell[] {
    const contextKeyCount = Object.keys(dimensions).length;
    const upper = Math.min(contextKeyCount, maxDimensionKeys);
    const matches: WorkspaceRuleCell[] = [];
    const matchSeen = new Set<string>();

    const appendFromBucket = (bucket: readonly WorkspaceRuleCell[] | undefined): void => {
      if (!bucket) {
        return;
      }
      for (const cell of bucket) {
        if (matchSeen.has(cell.cellId)) {
          continue;
        }
        if (cellMatchesDimensions(cell, dimensions)) {
          matchSeen.add(cell.cellId);
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

    return [...matches];
  }

  /**
   * Exact signature bucket (O(1)); does not include partial-dimension cells unless signature matches.
   */
  findExactBucket(dimensions: Readonly<Record<string, string>>): readonly WorkspaceRuleCell[] {
    const bucket = this.exactBuckets.get(this.signatureFor(dimensions));
    return bucket != null ? [...bucket] : [];
  }
}
