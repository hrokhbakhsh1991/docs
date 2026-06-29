import { validateCanonicalPathSegments } from "../canonical/canonical-document";
import { sdkOk, type SdkResult } from "../errors/sdk-result";
import {
  throwWorkspaceValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import { violationFromCanonicalPathFailure } from "./schema-helper";
import type { WorkspaceFieldKind, WorkspaceFieldRegistry, WorkspaceFieldRegistryEntry } from "./field-registry";
import {
  fail,
  isPlainObject,
  requireArray,
  requireBoolean,
  requireFiniteNumber,
  requireNonEmptyString,
  requireOneOf,
  requirePlainObject,
  violation,
} from "./schema-helper";

const FIELD_KINDS = new Set<WorkspaceFieldKind>([
  "text",
  "number",
  "date",
  "enum",
  "boolean",
  "composite",
]);

const MAX_FIELDS = 1000;
const MAX_ENUM_OPTIONS = 500;
const ENUM_TOKEN = /^[a-z][a-z0-9_-]*$/i;

type FieldResult = SdkResult<WorkspaceFieldRegistryEntry, WorkspaceSdkValidationErrorCode>;
type RegistryResult = SdkResult<WorkspaceFieldRegistry, WorkspaceSdkValidationErrorCode>;

function validateEnumField(
  field: Record<string, unknown>,
  index: number,
): SdkResult<null, WorkspaceSdkValidationErrorCode> {
  const options = field.enumOptions;
  if (!Array.isArray(options) || options.length === 0) {
    return fail(
      violation(
        "INVALID_FIELD_REGISTRY",
        `fieldRegistry.fields[${index}] kind enum requires non-empty enumOptions`,
      ),
    );
  }
  if (options.length > MAX_ENUM_OPTIONS) {
    return fail(
      violation(
        "INVALID_FIELD_REGISTRY",
        `fieldRegistry.fields[${index}].enumOptions exceeds maximum count (${MAX_ENUM_OPTIONS})`,
      ),
    );
  }
  const seen = new Set<string>();
  for (const [optIndex, option] of options.entries()) {
    if (typeof option !== "string" || option.trim() === "") {
      return fail(
        violation(
          "INVALID_FIELD_REGISTRY",
          `fieldRegistry.fields[${index}].enumOptions[${optIndex}] must be a non-empty string`,
        ),
      );
    }
    if (!ENUM_TOKEN.test(option)) {
      return fail(
        violation(
          "INVALID_FIELD_REGISTRY",
          `fieldRegistry.fields[${index}].enumOptions[${optIndex}] has invalid enum token "${option}"`,
        ),
      );
    }
    if (seen.has(option)) {
      return fail(
        violation(
          "INVALID_FIELD_REGISTRY",
          `Duplicate enum option "${option}" on field "${field.id}"`,
        ),
      );
    }
    seen.add(option);
  }
  return sdkOk(null);
}

function validateFieldEntry(
  raw: unknown,
  index: number,
  seenIds: Set<string>,
  seenPaths: Set<string>,
): FieldResult {
  if (!isPlainObject(raw)) {
    return fail(
      violation("INVALID_FIELD_REGISTRY", `fieldRegistry.fields[${index}] must be an object`),
    );
  }

  const id = requireNonEmptyString(
    raw.id,
    `fieldRegistry.fields[${index}].id`,
    "INVALID_FIELD_REGISTRY",
  );
  if (!id.ok) return id;
  if (seenIds.has(id.value)) {
    return fail(violation("DUPLICATE_FIELD_ID", `Duplicate field id "${id.value}" in fieldRegistry`));
  }
  seenIds.add(id.value);

  const canonicalPath = requireNonEmptyString(
    raw.canonicalPath,
    `fieldRegistry.fields[${index}].canonicalPath`,
    "INVALID_FIELD_REGISTRY",
  );
  if (!canonicalPath.ok) return canonicalPath;
  if (seenPaths.has(canonicalPath.value)) {
    return fail(
      violation(
        "DUPLICATE_CANONICAL_PATH",
        `Duplicate canonical path "${canonicalPath.value}" in fieldRegistry`,
      ),
    );
  }
  seenPaths.add(canonicalPath.value);

  const pathCheck = validateCanonicalPathSegments(canonicalPath.value);
  if (!pathCheck.ok) {
    return fail(
      violationFromCanonicalPathFailure(
        canonicalPath.value,
        pathCheck.error.code,
        pathCheck.error.message,
      ),
    );
  }

  const stepId = requireNonEmptyString(
    raw.stepId,
    `fieldRegistry.fields[${index}].stepId`,
    "INVALID_FIELD_REGISTRY",
  );
  if (!stepId.ok) return stepId;

  const kind = requireOneOf(
    raw.kind,
    FIELD_KINDS,
    `fieldRegistry.fields[${index}].kind`,
    "INVALID_FIELD_REGISTRY",
  );
  if (!kind.ok) return kind;

  const required = requireBoolean(
    raw.required,
    `fieldRegistry.fields[${index}].required`,
    "INVALID_FIELD_REGISTRY",
  );
  if (!required.ok) return required;

  if (raw.groupSlug != null) {
    const groupSlug = requireNonEmptyString(
      raw.groupSlug,
      `fieldRegistry.fields[${index}].groupSlug`,
      "INVALID_FIELD_REGISTRY",
    );
    if (!groupSlug.ok) return groupSlug;
  }

  if (kind.value === "enum") {
    const enumResult = validateEnumField(raw, index);
    if (!enumResult.ok) return enumResult;
  } else if (raw.enumOptions != null) {
    return fail(
      violation(
        "INVALID_FIELD_REGISTRY",
        `fieldRegistry.fields[${index}].enumOptions is only allowed when kind is enum`,
      ),
    );
  }

  const entry: WorkspaceFieldRegistryEntry = {
    id: id.value,
    canonicalPath: canonicalPath.value,
    stepId: stepId.value,
    kind: kind.value,
    required: required.value,
    ...(raw.groupSlug != null ? { groupSlug: raw.groupSlug as string } : {}),
    ...(raw.tags != null ? { tags: raw.tags as readonly string[] } : {}),
    ...(typeof raw.adminLabel === "string" && raw.adminLabel.trim().length > 0
      ? { adminLabel: raw.adminLabel.trim() }
      : {}),
    ...(typeof raw.adminDescription === "string" && raw.adminDescription.trim().length > 0
      ? { adminDescription: raw.adminDescription.trim() }
      : {}),
    ...(typeof raw.group === "string" && raw.group.trim().length > 0
      ? { group: raw.group.trim() }
      : {}),
    ...(typeof raw.icon === "string" && raw.icon.trim().length > 0
      ? { icon: raw.icon.trim() }
      : {}),
    ...(kind.value === "enum" ? { enumOptions: raw.enumOptions as readonly string[] } : {}),
  };

  return sdkOk(entry);
}

/** Declarative field-registry validation — pure Result, no throw. */
export function validateWorkspaceFieldRegistry(registry: unknown): RegistryResult {
  const root = requirePlainObject(registry, "fieldRegistry");
  if (!root.ok) return root;

  const version = requireFiniteNumber(root.value.version, "fieldRegistry.version", "INVALID_FIELD_REGISTRY");
  if (!version.ok) return version;

  const fieldsRaw = requireArray(root.value.fields, "fieldRegistry.fields", "INVALID_FIELD_REGISTRY");
  if (!fieldsRaw.ok) return fieldsRaw;
  if (fieldsRaw.value.length > MAX_FIELDS) {
    return fail(
      violation(
        "INVALID_FIELD_REGISTRY",
        `fieldRegistry.fields exceeds maximum count (${MAX_FIELDS})`,
      ),
    );
  }

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const fields: WorkspaceFieldRegistryEntry[] = [];

  for (const [index, entry] of fieldsRaw.value.entries()) {
    const fieldResult = validateFieldEntry(entry, index, seenIds, seenPaths);
    if (!fieldResult.ok) return fieldResult;
    fields.push(fieldResult.value);
  }

  return sdkOk({ version: version.value, fields });
}

export function assertWorkspaceFieldRegistry(registry: unknown): asserts registry is WorkspaceFieldRegistry {
  const result = validateWorkspaceFieldRegistry(registry);
  if (!result.ok) {
    throwWorkspaceValidationError(result.error.code, result.error.message, {
      cause: result.error.cause,
    });
  }
}
