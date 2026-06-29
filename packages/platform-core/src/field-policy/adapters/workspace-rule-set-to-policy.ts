import type {
  WorkspaceFieldRegistry,
  WorkspaceFieldRegistryEntry,
  WorkspaceRuleCell,
  WorkspaceRuleFieldOverride,
  WorkspaceRuleSet,
} from "@app-tour/workspace-sdk/registry";

import { adaptWorkspaceFieldRegistryToFieldDefinitions } from "./workspace-field-registry-to-definitions";
import type {
  FieldDefinition,
  FieldPolicyRule,
  FieldPolicyState,
  FieldPolicySurface,
  SimpleCondition,
} from "../types";

export type WorkspaceRuleSetPolicyAdapterInput = {
  readonly workspaceType: string;
  readonly fieldRegistry: WorkspaceFieldRegistry;
  readonly ruleSet: WorkspaceRuleSet;
  readonly surface?: FieldPolicySurface;
  readonly dimensionPathPrefix?: string;
};

export type UnsupportedWorkspaceRuleCell = {
  readonly cellId: string;
  readonly reason: "MULTI_DIMENSION_CONDITION_UNSUPPORTED";
  readonly dimensions: Readonly<Record<string, string>>;
};

export type WorkspaceRuleSetPolicyAdapterResult = {
  readonly definitions: readonly FieldDefinition[];
  readonly rules: readonly FieldPolicyRule[];
  readonly unsupportedCells: readonly UnsupportedWorkspaceRuleCell[];
};

function conditionForCell(
  cell: WorkspaceRuleCell,
  dimensionPathPrefix: string,
): SimpleCondition | null {
  const entries = Object.entries(cell.dimensions);
  if (entries.length === 0) {
    return { kind: "always" };
  }
  if (entries.length !== 1) {
    return null;
  }
  const [key, value] = entries[0]!;
  return { kind: "equals", path: `${dimensionPathPrefix}.${key}`, value };
}

function stateForField(
  field: WorkspaceFieldRegistryEntry,
  override: WorkspaceRuleFieldOverride | undefined,
): FieldPolicyState {
  if (override?.hidden === true) {
    return "hidden";
  }
  if (override?.required === true || (override?.required == null && field.required)) {
    return "required";
  }
  return "visible";
}

export function adaptWorkspaceRuleSetToFieldPolicy(
  input: WorkspaceRuleSetPolicyAdapterInput,
): WorkspaceRuleSetPolicyAdapterResult {
  const surface = input.surface ?? "wizard";
  const dimensionPathPrefix = input.dimensionPathPrefix ?? "dimensions";
  const definitions = adaptWorkspaceFieldRegistryToFieldDefinitions(input);
  const rules: FieldPolicyRule[] = [];
  const unsupportedCells: UnsupportedWorkspaceRuleCell[] = [];

  for (const [cellIndex, cell] of input.ruleSet.cells.entries()) {
    const condition = conditionForCell(cell, dimensionPathPrefix);
    if (condition === null) {
      unsupportedCells.push({
        cellId: cell.cellId,
        reason: "MULTI_DIMENSION_CONDITION_UNSUPPORTED",
        dimensions: cell.dimensions,
      });
      continue;
    }

    for (const field of input.fieldRegistry.fields) {
      const override = cell.fieldOverrides.find((candidate) => candidate.fieldId === field.id);
      rules.push({
        id: `${input.workspaceType}.${surface}.${cell.cellId}.${field.id}`,
        workspaceType: input.workspaceType,
        fieldId: field.id,
        surface,
        state: stateForField(field, override),
        condition,
        priority: cell.priority ?? cellIndex,
        enabled: true,
      });
    }
  }

  return {
    definitions,
    rules,
    unsupportedCells,
  };
}
