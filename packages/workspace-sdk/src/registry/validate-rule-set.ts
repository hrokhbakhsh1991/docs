import { sdkOk, type SdkResult } from "../errors/sdk-result";
import {
  throwWorkspaceValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import type { WorkspaceRuleCell, WorkspaceRuleSet } from "./rule-set";
import {
  fail,
  isPlainObject,
  requireArray,
  requireFiniteNumber,
  requireNonEmptyString,
  requirePlainObject,
  violation,
} from "./schema-helper";

const MAX_MATRIX_DIMENSIONS = 16;
const MAX_RULE_SET_CELLS = 256;
const MAX_FIELD_OVERRIDES_PER_CELL = 1000;
const MAX_DIMENSION_VALUE_LENGTH = 64_000;

type RuleSetResult = SdkResult<WorkspaceRuleSet, WorkspaceSdkValidationErrorCode>;

function isEmptyDimensions(dimensions: Readonly<Record<string, string>>): boolean {
  return Object.keys(dimensions).length === 0;
}

export function validateWorkspaceRuleSet(
  ruleSet: unknown,
  knownFieldIds: ReadonlySet<string>,
): RuleSetResult {
  const root = requirePlainObject(ruleSet, "ruleSet", "INVALID_RULE_SET");
  if (!root.ok) return root;

  const version = requireFiniteNumber(root.value.version, "ruleSet.version", "INVALID_RULE_SET");
  if (!version.ok) return version;

  const matrixRaw = requireArray(
    root.value.matrixDimensions,
    "ruleSet.matrixDimensions",
    "INVALID_RULE_SET",
  );
  if (!matrixRaw.ok) return matrixRaw;
  if (matrixRaw.value.length > MAX_MATRIX_DIMENSIONS) {
    return fail(
      violation(
        "INVALID_RULE_SET",
        `ruleSet.matrixDimensions exceeds maximum count (${MAX_MATRIX_DIMENSIONS})`,
      ),
    );
  }

  const allowedDimensions = new Set<string>();
  for (const [index, dimension] of matrixRaw.value.entries()) {
    const dim = requireNonEmptyString(
      dimension,
      `ruleSet.matrixDimensions[${index}]`,
      "INVALID_RULE_SET",
    );
    if (!dim.ok) return dim;
    allowedDimensions.add(dim.value);
  }

  const defaultCellId = requireNonEmptyString(
    root.value.defaultCellId,
    "ruleSet.defaultCellId",
    "INVALID_RULE_SET",
  );
  if (!defaultCellId.ok) return defaultCellId;

  const cellsRaw = requireArray(root.value.cells, "ruleSet.cells", "INVALID_RULE_SET");
  if (!cellsRaw.ok) return cellsRaw;
  if (cellsRaw.value.length > MAX_RULE_SET_CELLS) {
    return fail(
      violation(
        "INVALID_RULE_SET",
        `ruleSet.cells exceeds maximum count (${MAX_RULE_SET_CELLS})`,
      ),
    );
  }

  const seenCellIds = new Set<string>();
  const catchAllCells: WorkspaceRuleCell[] = [];
  const cells: WorkspaceRuleCell[] = [];

  for (const [index, rawCell] of cellsRaw.value.entries()) {
    if (!isPlainObject(rawCell)) {
      return fail(violation("INVALID_RULE_SET", `ruleSet.cells[${index}] must be an object`));
    }

    const cellId = requireNonEmptyString(
      rawCell.cellId,
      `ruleSet.cells[${index}].cellId`,
      "INVALID_RULE_SET",
    );
    if (!cellId.ok) return cellId;
    if (seenCellIds.has(cellId.value)) {
      return fail(
        violation("DUPLICATE_CELL_ID", `Duplicate rule cell id "${cellId.value}" in ruleSet.cells`),
      );
    }
    seenCellIds.add(cellId.value);

    const dimensionsRoot = requirePlainObject(
      rawCell.dimensions,
      `ruleSet.cells[${index}].dimensions`,
      "INVALID_RULE_SET",
    );
    if (!dimensionsRoot.ok) return dimensionsRoot;

    const dimensions: Record<string, string> = {};
    for (const [key, value] of Object.entries(dimensionsRoot.value)) {
      if (!allowedDimensions.has(key)) {
        return fail(
          violation(
            "INVALID_RULE_SET",
            `cell "${cellId.value}" dimension key "${key}" is not in matrixDimensions`,
          ),
        );
      }
      if (typeof value !== "string") {
        return fail(
          violation(
            "INVALID_RULE_SET",
            `cell "${cellId.value}" dimension "${key}" must be a string value`,
          ),
        );
      }
      if (value.length > MAX_DIMENSION_VALUE_LENGTH) {
        return fail(
          violation(
            "INVALID_RULE_SET",
            `cell "${cellId.value}" dimension "${key}" exceeds maximum length (${MAX_DIMENSION_VALUE_LENGTH})`,
          ),
        );
      }
      dimensions[key] = value;
    }

    if (
      rawCell.priority != null &&
      (typeof rawCell.priority !== "number" || !Number.isFinite(rawCell.priority))
    ) {
      return fail(
        violation("INVALID_RULE_SET", `cell "${cellId.value}" priority must be a finite number when set`),
      );
    }

    const overridesRaw = requireArray(
      rawCell.fieldOverrides,
      `ruleSet.cells[${index}].fieldOverrides`,
      "INVALID_RULE_SET",
    );
    if (!overridesRaw.ok) return overridesRaw;
    if (overridesRaw.value.length > MAX_FIELD_OVERRIDES_PER_CELL) {
      return fail(
        violation(
          "INVALID_RULE_SET",
          `ruleSet.cells[${index}].fieldOverrides exceeds maximum count (${MAX_FIELD_OVERRIDES_PER_CELL})`,
        ),
      );
    }

    for (const [overrideIndex, override] of overridesRaw.value.entries()) {
      if (!isPlainObject(override)) {
        return fail(
          violation(
            "INVALID_RULE_SET",
            `ruleSet.cells[${index}].fieldOverrides[${overrideIndex}] must be an object`,
          ),
        );
      }
      const fieldId = requireNonEmptyString(
        override.fieldId,
        `ruleSet.cells[${index}].fieldOverrides[${overrideIndex}].fieldId`,
        "INVALID_RULE_SET",
      );
      if (!fieldId.ok) return fieldId;
      if (!knownFieldIds.has(fieldId.value)) {
        return fail(
          violation(
            "UNKNOWN_FIELD_ID",
            `Unknown field id "${fieldId.value}" in ruleSet.cells[${index}].fieldOverrides`,
          ),
        );
      }
      if (override.hidden != null && typeof override.hidden !== "boolean") {
        return fail(
          violation("INVALID_RULE_SET", `override for "${fieldId.value}" hidden must be a boolean`),
        );
      }
      if (override.required != null && typeof override.required !== "boolean") {
        return fail(
          violation("INVALID_RULE_SET", `override for "${fieldId.value}" required must be a boolean`),
        );
      }
    }

    const normalizedCell: WorkspaceRuleCell = {
      cellId: cellId.value,
      dimensions,
      priority: rawCell.priority as number | undefined,
      fieldOverrides: rawCell.fieldOverrides as WorkspaceRuleCell["fieldOverrides"],
    };

    if (isEmptyDimensions(normalizedCell.dimensions)) {
      catchAllCells.push(normalizedCell);
    }
    cells.push(normalizedCell);
  }

  if (!seenCellIds.has(defaultCellId.value)) {
    return fail(
      violation(
        "INVALID_RULE_SET",
        `defaultCellId "${defaultCellId.value}" is not in ruleSet.cells`,
      ),
    );
  }

  if (catchAllCells.length > 1) {
    const priorities = catchAllCells.map((cell) => cell.priority);
    const allHavePriority = priorities.every((priority) => typeof priority === "number");
    const distinctPriorities = new Set(priorities);
    if (!allHavePriority || distinctPriorities.size !== catchAllCells.length) {
      return fail(
        violation(
          "INVALID_RULE_SET",
          "Multiple catch-all cells (empty dimensions) require distinct explicit priority values",
        ),
      );
    }
  }

  return sdkOk({
    version: version.value,
    matrixDimensions: matrixRaw.value as string[],
    defaultCellId: defaultCellId.value,
    cells,
  });
}

export function assertWorkspaceRuleSet(
  ruleSet: unknown,
  knownFieldIds: ReadonlySet<string>,
): asserts ruleSet is WorkspaceRuleSet {
  const result = validateWorkspaceRuleSet(ruleSet, knownFieldIds);
  if (!result.ok) {
    throwWorkspaceValidationError(result.error.code, result.error.message);
  }
}
