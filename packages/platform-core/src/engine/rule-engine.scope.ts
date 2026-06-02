import { getWorkspaceRuleCell, type WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import type { EffectiveFieldState } from "../types/effective-field-state";
import type { RuleContext } from "../types/rule-context";
import { filterRuleContextDimensions } from "../utils/rule-context-dimensions";
import { normalizeRuleContext } from "../utils/rule-context";
import type { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleCellIndex } from "./rule-cell-index";
import { pickBestMatchingCell } from "./rule-resolution";

/**
 * Per–RuleContext transaction scope: one cell resolution + memoized effective fields.
 */
export class RuleEngineScope {
  private readonly normalized: RuleContext;
  private readonly filteredDimensions: Record<string, string>;
  private resolvedCellId: string | undefined;
  private readonly effectiveByFieldId = new Map<string, EffectiveFieldState>();

  constructor(
    private readonly ruleSet: WorkspaceRuleSet,
    private readonly fieldEngine: FieldRegistryEngine,
    private readonly cellIndex: RuleCellIndex,
    context: RuleContext,
  ) {
    this.normalized = normalizeRuleContext(context);
    this.filteredDimensions = filterRuleContextDimensions(
      this.normalized.dimensions,
      this.ruleSet.matrixDimensions,
    );
  }

  get dimensions(): Readonly<Record<string, string>> {
    return this.filteredDimensions;
  }

  resolveCellId(): string {
    if (this.resolvedCellId != null) {
      return this.resolvedCellId;
    }

    if (this.normalized.forceCellId != null) {
      if (process.env.NODE_ENV !== "test") {
        throw new PlatformCoreError(
          "INVALID_RULE_CONTEXT",
          "forceCellId is only allowed when NODE_ENV is test",
        );
      }
      const forced = getWorkspaceRuleCell(this.ruleSet, this.normalized.forceCellId);
      if (!forced) {
        throw new PlatformCoreError(
          "INVALID_RULE_SET",
          `forceCellId "${this.normalized.forceCellId}" is not in ruleSet.cells`,
        );
      }
      this.resolvedCellId = forced.cellId;
      return this.resolvedCellId;
    }

    const matches = this.cellIndex.findMatches(
      this.filteredDimensions,
      this.ruleSet.matrixDimensions.length,
    );

    if (matches.length === 0) {
      throw new PlatformCoreError(
        "RULE_CONTEXT_UNMATCHED",
        `No rule cell matches context dimensions ${JSON.stringify(this.filteredDimensions)}`,
        {
          dimensions: this.filteredDimensions,
          defaultCellId: this.ruleSet.defaultCellId,
          matrixDimensions: this.ruleSet.matrixDimensions,
        },
      );
    }

    this.resolvedCellId = pickBestMatchingCell(matches, this.filteredDimensions).cellId;
    return this.resolvedCellId;
  }

  resolveEffectiveField(fieldId: string): EffectiveFieldState {
    const cached = this.effectiveByFieldId.get(fieldId);
    if (cached != null) {
      return cached;
    }

    const entry = this.fieldEngine.getById(fieldId);
    if (!entry) {
      throw new PlatformCoreError(
        "UNKNOWN_FIELD_ID",
        `Unknown field id "${fieldId}" in registry`,
      );
    }

    const cellId = this.resolveCellId();
    const cell = getWorkspaceRuleCell(this.ruleSet, cellId);
    if (!cell) {
      throw new PlatformCoreError(
        "INVALID_RULE_SET",
        `Resolved cellId "${cellId}" is missing from ruleSet.cells`,
        { cellId, fieldId },
      );
    }

    const override = cell.fieldOverrides.find((o) => o.fieldId === fieldId);
    const effective: EffectiveFieldState = {
      fieldId,
      entry,
      required: override?.required ?? entry.required,
      hidden: override?.hidden ?? false,
    };
    this.effectiveByFieldId.set(fieldId, effective);
    return effective;
  }
}
