import {
  assertCanonicalPathSegments,
  CanonicalDocumentValidationError,
} from "../canonical/canonical-document";
import type { WorkspaceFieldKind, WorkspaceFieldRegistry } from "../registry/field-registry";
import type { WorkspaceRuleCell, WorkspaceRuleSet } from "../registry/rule-set";
import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";
import { validateLifecycleGraph } from "./workspace-lifecycle-validation";
import type { WorkspacePlugin } from "./workspace-plugin.contract";
import type { WorkspaceValidationHooks } from "./workspace-validation";
import type { WorkspaceWizardMode, WorkspaceWizardSurface } from "./workspace-wizard-surface";

const FIELD_KINDS = new Set<WorkspaceFieldKind>([
  "text",
  "number",
  "date",
  "enum",
  "boolean",
  "composite",
]);

const WIZARD_MODES = new Set<WorkspaceWizardMode>(["classic", "schema"]);

export type WorkspacePluginValidationErrorCode =
  | "PLUGIN_INVALID_SHAPE"
  | "UNKNOWN_FIELD_ID"
  | "DUPLICATE_FIELD_ID"
  | "DUPLICATE_CANONICAL_PATH"
  | "INVALID_FIELD_REGISTRY"
  | "DUPLICATE_CELL_ID"
  | "INVALID_RULE_SET"
  | "INVALID_WIZARD_SURFACE"
  | "INVALID_VALIDATION_HOOKS"
  | "INVALID_LIFECYCLE";

export class WorkspacePluginValidationError extends Error {
  readonly code: WorkspacePluginValidationErrorCode;

  constructor(code: WorkspacePluginValidationErrorCode, message: string) {
    super(message);
    this.name = "WorkspacePluginValidationError";
    this.code = code;
  }
}

function fail(code: WorkspacePluginValidationErrorCode, message: string): never {
  throw new WorkspacePluginValidationError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isEmptyDimensions(dimensions: Readonly<Record<string, string>>): boolean {
  return Object.keys(dimensions).length === 0;
}

export function assertWorkspaceFieldRegistry(registry: unknown): asserts registry is WorkspaceFieldRegistry {
  if (!isPlainObject(registry)) {
    fail("INVALID_FIELD_REGISTRY", "fieldRegistry must be a plain object");
  }

  if (typeof registry.version !== "number" || !Number.isFinite(registry.version)) {
    fail("INVALID_FIELD_REGISTRY", "fieldRegistry.version must be a finite number");
  }

  if (!Array.isArray(registry.fields)) {
    fail("INVALID_FIELD_REGISTRY", "fieldRegistry.fields must be an array");
  }

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const [index, field] of registry.fields.entries()) {
    if (!isPlainObject(field)) {
      fail("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}] must be an object`);
    }

    if (typeof field.id !== "string" || field.id.length === 0) {
      fail("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}].id must be a non-empty string`);
    }
    if (seenIds.has(field.id)) {
      fail("DUPLICATE_FIELD_ID", `Duplicate field id "${field.id}" in fieldRegistry`);
    }
    seenIds.add(field.id);

    if (typeof field.canonicalPath !== "string" || field.canonicalPath.length === 0) {
      fail(
        "INVALID_FIELD_REGISTRY",
        `fieldRegistry.fields[${index}].canonicalPath must be a non-empty string`,
      );
    }
    if (seenPaths.has(field.canonicalPath)) {
      fail(
        "DUPLICATE_CANONICAL_PATH",
        `Duplicate canonical path "${field.canonicalPath}" in fieldRegistry`,
      );
    }
    seenPaths.add(field.canonicalPath);

    try {
      assertCanonicalPathSegments(field.canonicalPath);
    } catch (error) {
      if (error instanceof CanonicalDocumentValidationError) {
        fail("INVALID_FIELD_REGISTRY", error.message);
      }
      throw error;
    }

    if (typeof field.stepId !== "string" || field.stepId.length === 0) {
      fail("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}].stepId must be a non-empty string`);
    }

    if (!FIELD_KINDS.has(field.kind as WorkspaceFieldKind)) {
      fail("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}].kind is invalid`);
    }

    if (typeof field.required !== "boolean") {
      fail("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}].required must be a boolean`);
    }

    if (field.groupSlug != null && (typeof field.groupSlug !== "string" || field.groupSlug.length === 0)) {
      fail("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}].groupSlug must be a non-empty string`);
    }

    if (field.kind === "enum") {
      if (!Array.isArray(field.enumOptions) || field.enumOptions.length === 0) {
        fail(
          "INVALID_FIELD_REGISTRY",
          `fieldRegistry.fields[${index}] kind enum requires non-empty enumOptions`,
        );
      }
      const seenEnum = new Set<string>();
      for (const [optIndex, option] of field.enumOptions.entries()) {
          if (typeof option !== "string" || option.trim() === "") {
            fail(
              "INVALID_FIELD_REGISTRY",
              `fieldRegistry.fields[${index}].enumOptions[${optIndex}] must be a non-empty string`,
            );
          }
          if (!/^[a-z][a-z0-9_-]*$/i.test(option)) {
            fail(
              "INVALID_FIELD_REGISTRY",
              `fieldRegistry.fields[${index}].enumOptions[${optIndex}] has invalid enum token "${option}"`,
            );
          }
          if (seenEnum.has(option)) {
            fail(
              "INVALID_FIELD_REGISTRY",
              `Duplicate enum option "${option}" on field "${field.id}"`,
            );
          }
          seenEnum.add(option);
        }
    } else if (field.enumOptions != null) {
      fail(
        "INVALID_FIELD_REGISTRY",
        `fieldRegistry.fields[${index}].enumOptions is only allowed when kind is enum`,
      );
    }
  }
}

export function assertWorkspaceRuleSet(
  ruleSet: unknown,
  knownFieldIds: ReadonlySet<string>,
): asserts ruleSet is WorkspaceRuleSet {
  if (!isPlainObject(ruleSet)) {
    fail("INVALID_RULE_SET", "ruleSet must be a plain object");
  }

  if (typeof ruleSet.version !== "number" || !Number.isFinite(ruleSet.version)) {
    fail("INVALID_RULE_SET", "ruleSet.version must be a finite number");
  }

  if (!Array.isArray(ruleSet.matrixDimensions)) {
    fail("INVALID_RULE_SET", "ruleSet.matrixDimensions must be an array");
  }

  const allowedDimensions = new Set<string>();
  for (const [index, dimension] of ruleSet.matrixDimensions.entries()) {
    if (typeof dimension !== "string" || dimension.length === 0) {
      fail("INVALID_RULE_SET", `ruleSet.matrixDimensions[${index}] must be a non-empty string`);
    }
    allowedDimensions.add(dimension);
  }

  if (typeof ruleSet.defaultCellId !== "string" || ruleSet.defaultCellId.length === 0) {
    fail("INVALID_RULE_SET", "ruleSet.defaultCellId must be a non-empty string");
  }

  if (!Array.isArray(ruleSet.cells)) {
    fail("INVALID_RULE_SET", "ruleSet.cells must be an array");
  }

  const seenCellIds = new Set<string>();
  const catchAllCells: WorkspaceRuleCell[] = [];

  for (const [index, cell] of ruleSet.cells.entries()) {
    if (!isPlainObject(cell)) {
      fail("INVALID_RULE_SET", `ruleSet.cells[${index}] must be an object`);
    }

    if (typeof cell.cellId !== "string" || cell.cellId.length === 0) {
      fail("INVALID_RULE_SET", `ruleSet.cells[${index}].cellId must be a non-empty string`);
    }
    if (seenCellIds.has(cell.cellId)) {
      fail("DUPLICATE_CELL_ID", `Duplicate rule cell id "${cell.cellId}" in ruleSet.cells`);
    }
    seenCellIds.add(cell.cellId);

    if (!isPlainObject(cell.dimensions)) {
      fail("INVALID_RULE_SET", `ruleSet.cells[${index}].dimensions must be a plain object`);
    }

    const dimensions: Record<string, string> = {};
    for (const [key, value] of Object.entries(cell.dimensions)) {
      if (!allowedDimensions.has(key)) {
        fail(
          "INVALID_RULE_SET",
          `cell "${cell.cellId}" dimension key "${key}" is not in matrixDimensions`,
        );
      }
      if (typeof value !== "string") {
        fail(
          "INVALID_RULE_SET",
          `cell "${cell.cellId}" dimension "${key}" must be a string value`,
        );
      }
      dimensions[key] = value;
    }

    if (cell.priority != null && (typeof cell.priority !== "number" || !Number.isFinite(cell.priority))) {
      fail("INVALID_RULE_SET", `cell "${cell.cellId}" priority must be a finite number when set`);
    }

    if (!Array.isArray(cell.fieldOverrides)) {
      fail("INVALID_RULE_SET", `ruleSet.cells[${index}].fieldOverrides must be an array`);
    }

    for (const [overrideIndex, override] of cell.fieldOverrides.entries()) {
      if (!isPlainObject(override)) {
        fail(
          "INVALID_RULE_SET",
          `ruleSet.cells[${index}].fieldOverrides[${overrideIndex}] must be an object`,
        );
      }
      if (typeof override.fieldId !== "string" || override.fieldId.length === 0) {
        fail(
          "INVALID_RULE_SET",
          `ruleSet.cells[${index}].fieldOverrides[${overrideIndex}].fieldId must be a non-empty string`,
        );
      }
      if (!knownFieldIds.has(override.fieldId)) {
        fail(
          "UNKNOWN_FIELD_ID",
          `Unknown field id "${override.fieldId}" in ruleSet.cells[${index}].fieldOverrides`,
        );
      }
      if (override.hidden != null && typeof override.hidden !== "boolean") {
        fail("INVALID_RULE_SET", `override for "${override.fieldId}" hidden must be a boolean`);
      }
      if (override.required != null && typeof override.required !== "boolean") {
        fail("INVALID_RULE_SET", `override for "${override.fieldId}" required must be a boolean`);
      }
    }

    const normalizedCell = {
      cellId: cell.cellId,
      dimensions,
      priority: cell.priority,
      fieldOverrides: cell.fieldOverrides,
    } as WorkspaceRuleCell;

    if (isEmptyDimensions(normalizedCell.dimensions)) {
      catchAllCells.push(normalizedCell);
    }
  }

  if (!seenCellIds.has(ruleSet.defaultCellId)) {
    fail(
      "INVALID_RULE_SET",
      `defaultCellId "${ruleSet.defaultCellId}" is not in ruleSet.cells`,
    );
  }

  if (catchAllCells.length > 1) {
    const priorities = catchAllCells.map((cell) => cell.priority);
    const allHavePriority = priorities.every((priority) => typeof priority === "number");
    const distinctPriorities = new Set(priorities);
    if (!allHavePriority || distinctPriorities.size !== catchAllCells.length) {
      fail(
        "INVALID_RULE_SET",
        "Multiple catch-all cells (empty dimensions) require distinct explicit priority values",
      );
    }
  }
}

function assertWorkspaceWizardSurface(wizard: unknown): asserts wizard is WorkspaceWizardSurface {
  if (!isPlainObject(wizard)) {
    fail("INVALID_WIZARD_SURFACE", "wizard must be a plain object");
  }

  if (!WIZARD_MODES.has(wizard.wizardMode as WorkspaceWizardMode)) {
    fail("INVALID_WIZARD_SURFACE", 'wizard.wizardMode must be "classic" or "schema"');
  }

  if (typeof wizard.railId !== "string" || wizard.railId.length === 0) {
    fail("INVALID_WIZARD_SURFACE", "wizard.railId must be a non-empty string");
  }

  if (!Array.isArray(wizard.roots)) {
    fail("INVALID_WIZARD_SURFACE", "wizard.roots must be an array");
  }

  for (const [index, root] of wizard.roots.entries()) {
    if (typeof root !== "string" || root.length === 0) {
      fail("INVALID_WIZARD_SURFACE", `wizard.roots[${index}] must be a non-empty string`);
    }
  }

  if (!Array.isArray(wizard.inactiveFieldGroups)) {
    fail("INVALID_WIZARD_SURFACE", "wizard.inactiveFieldGroups must be an array");
  }

  for (const [index, group] of wizard.inactiveFieldGroups.entries()) {
    if (typeof group !== "string" || group.length === 0) {
      fail(
        "INVALID_WIZARD_SURFACE",
        `wizard.inactiveFieldGroups[${index}] must be a non-empty string`,
      );
    }
  }

  if (typeof wizard.wizardCapacityStepRedundant !== "boolean") {
    fail("INVALID_WIZARD_SURFACE", "wizard.wizardCapacityStepRedundant must be a boolean");
  }
}

function assertWorkspaceValidationHooks(
  validation: unknown,
): asserts validation is WorkspaceValidationHooks {
  if (!isPlainObject(validation)) {
    fail("INVALID_VALIDATION_HOOKS", "validation must be a plain object");
  }

  if (typeof validation.checkCapacity !== "function") {
    fail("INVALID_VALIDATION_HOOKS", "validation.checkCapacity must be a function");
  }

  if (typeof validation.checkTripDetails !== "function") {
    fail("INVALID_VALIDATION_HOOKS", "validation.checkTripDetails must be a function");
  }
}

function assertWorkspaceLifecycleContract(
  lifecycle: unknown,
): asserts lifecycle is WorkspaceLifecycleContract {
  if (!isPlainObject(lifecycle)) {
    fail("INVALID_LIFECYCLE", "lifecycle must be a plain object");
  }

  if (typeof lifecycle.initialStatus !== "string" || lifecycle.initialStatus.length === 0) {
    fail("INVALID_LIFECYCLE", "lifecycle.initialStatus must be a non-empty string");
  }

  if (typeof lifecycle.publishStatus !== "string" || lifecycle.publishStatus.length === 0) {
    fail("INVALID_LIFECYCLE", "lifecycle.publishStatus must be a non-empty string");
  }

  if (!Array.isArray(lifecycle.allowedTransitions)) {
    fail("INVALID_LIFECYCLE", "lifecycle.allowedTransitions must be an array");
  }

  for (const [index, transition] of lifecycle.allowedTransitions.entries()) {
    if (!isPlainObject(transition)) {
      fail("INVALID_LIFECYCLE", `lifecycle.allowedTransitions[${index}] must be an object`);
    }
    if (typeof transition.from !== "string" || transition.from.length === 0) {
      fail("INVALID_LIFECYCLE", `lifecycle.allowedTransitions[${index}].from must be a non-empty string`);
    }
    if (typeof transition.to !== "string" || transition.to.length === 0) {
      fail("INVALID_LIFECYCLE", `lifecycle.allowedTransitions[${index}].to must be a non-empty string`);
    }
  }

  const lifecycleMessage = validateLifecycleGraph({
    initialStatus: lifecycle.initialStatus as string,
    publishStatus: lifecycle.publishStatus as string,
    allowedTransitions: lifecycle.allowedTransitions as WorkspaceLifecycleContract["allowedTransitions"],
  });
  if (lifecycleMessage != null) {
    fail("INVALID_LIFECYCLE", lifecycleMessage);
  }
}

function assertCanonicalPathsAlignWithWizard(
  registry: WorkspaceFieldRegistry,
  wizard: WorkspaceWizardSurface,
): void {
  const rootSet = new Set(wizard.roots);

  for (const field of registry.fields) {
    const topLevel = field.canonicalPath.split(".")[0];
    if (!topLevel || !rootSet.has(topLevel)) {
      fail(
        "INVALID_FIELD_REGISTRY",
        `Field "${field.id}" canonicalPath root "${topLevel ?? ""}" is not in wizard.roots`,
      );
    }
  }

  for (const stepId of new Set(registry.fields.map((field) => field.stepId))) {
    if (!rootSet.has(stepId)) {
      fail(
        "INVALID_WIZARD_SURFACE",
        `stepId "${stepId}" has registry fields but is not listed in wizard.roots`,
      );
    }
  }
}

/**
 * Deep runtime validation for workspace plugins. Throws {@link WorkspacePluginValidationError}
 * on any structural violation — never a raw TypeError.
 */
export function assertWorkspacePlugin(value: unknown): asserts value is WorkspacePlugin {
  if (!isPlainObject(value)) {
    fail("PLUGIN_INVALID_SHAPE", "Value is not a WorkspacePlugin");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    fail("PLUGIN_INVALID_SHAPE", "plugin.id must be a non-empty string");
  }

  if (typeof value.version !== "number" || !Number.isFinite(value.version)) {
    fail("PLUGIN_INVALID_SHAPE", "plugin.version must be a finite number");
  }

  if (!Array.isArray(value.supportedWorkspaceTypes)) {
    fail("PLUGIN_INVALID_SHAPE", "plugin.supportedWorkspaceTypes must be an array");
  }

  for (const [index, workspaceType] of value.supportedWorkspaceTypes.entries()) {
    if (typeof workspaceType !== "string" || workspaceType.length === 0) {
      fail(
        "PLUGIN_INVALID_SHAPE",
        `plugin.supportedWorkspaceTypes[${index}] must be a non-empty string`,
      );
    }
  }

  assertWorkspaceFieldRegistry(value.fieldRegistry);
  const knownFieldIds = new Set(
    (value.fieldRegistry as WorkspaceFieldRegistry).fields.map((field) => field.id),
  );

  assertWorkspaceRuleSet(value.ruleSet, knownFieldIds);
  assertWorkspaceWizardSurface(value.wizard);
  assertCanonicalPathsAlignWithWizard(
    value.fieldRegistry as WorkspaceFieldRegistry,
    value.wizard as WorkspaceWizardSurface,
  );
  assertWorkspaceValidationHooks(value.validation);
  assertWorkspaceLifecycleContract(value.lifecycle);
}
