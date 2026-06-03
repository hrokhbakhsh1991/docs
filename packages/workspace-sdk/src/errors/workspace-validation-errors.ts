/** Domain-scoped workspace SDK validation errors (GE-01 breaking split). */

export type WorkspacePluginShapeErrorCode =
  | "PLUGIN_INVALID_SHAPE"
  | "PLUGIN_FUNCTION_NOT_ALLOWED";

export type WorkspaceRegistryValidationErrorCode =
  | "UNKNOWN_FIELD_ID"
  | "DUPLICATE_FIELD_ID"
  | "DUPLICATE_CANONICAL_PATH"
  | "INVALID_FIELD_REGISTRY";

export type WorkspaceRuleSetValidationErrorCode =
  | "DUPLICATE_CELL_ID"
  | "INVALID_RULE_SET";

export type WorkspaceWizardValidationErrorCode = "INVALID_WIZARD_SURFACE";

export type WorkspaceHooksValidationErrorCode = "INVALID_VALIDATION_HOOKS";

export type LifecycleGraphErrorCode =
  | "INVALID_LIFECYCLE"
  | "CYCLE_DETECTED"
  | "UNREACHABLE_PUBLISH"
  | "ORPHAN_STATE";

export type WorkspaceThemeValidationErrorCode =
  | "TENANT_INVALID_SHAPE"
  | "INVALID_THEME_ID"
  | "INVALID_THEME_VERSION"
  | "THEME_CSS_VARIABLE_LIMIT"
  | "INVALID_THEME_CSS_KEY"
  | "INVALID_THEME_CSS_VALUE"
  | "UNSAFE_THEME_CSS_VALUE"
  | "INVALID_THEME_STYLESHEET"
  | "UNSEALED_THEME";

export type WorkspaceSdkValidationErrorCode =
  | WorkspacePluginShapeErrorCode
  | WorkspaceRegistryValidationErrorCode
  | WorkspaceRuleSetValidationErrorCode
  | WorkspaceWizardValidationErrorCode
  | WorkspaceHooksValidationErrorCode
  | LifecycleGraphErrorCode
  | WorkspaceThemeValidationErrorCode;

/** @deprecated Use domain-specific error classes. */
export type WorkspacePluginValidationErrorCode = WorkspaceSdkValidationErrorCode;

abstract class WorkspaceSdkValidationErrorBase extends Error {
  abstract readonly code: WorkspaceSdkValidationErrorCode;
}

export class WorkspacePluginShapeError extends WorkspaceSdkValidationErrorBase {
  readonly code: WorkspacePluginShapeErrorCode;
  constructor(code: WorkspacePluginShapeErrorCode, message: string) {
    super(message);
    this.name = "WorkspacePluginShapeError";
    this.code = code;
  }
}

export class WorkspaceRegistryValidationError extends WorkspaceSdkValidationErrorBase {
  readonly code: WorkspaceRegistryValidationErrorCode;
  readonly cause?: { readonly domain: "canonical"; readonly code: string };

  constructor(
    code: WorkspaceRegistryValidationErrorCode,
    message: string,
    cause?: { readonly domain: "canonical"; readonly code: string },
  ) {
    super(message);
    this.name = "WorkspaceRegistryValidationError";
    this.code = code;
    this.cause = cause;
  }
}

export class WorkspaceRuleSetValidationError extends WorkspaceSdkValidationErrorBase {
  readonly code: WorkspaceRuleSetValidationErrorCode;
  constructor(code: WorkspaceRuleSetValidationErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceRuleSetValidationError";
    this.code = code;
  }
}

export class WorkspaceWizardValidationError extends WorkspaceSdkValidationErrorBase {
  readonly code: WorkspaceWizardValidationErrorCode;
  constructor(code: WorkspaceWizardValidationErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceWizardValidationError";
    this.code = code;
  }
}

export class WorkspaceHooksValidationError extends WorkspaceSdkValidationErrorBase {
  readonly code: WorkspaceHooksValidationErrorCode;
  constructor(code: WorkspaceHooksValidationErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceHooksValidationError";
    this.code = code;
  }
}

export class WorkspaceLifecycleValidationError extends WorkspaceSdkValidationErrorBase {
  readonly code: LifecycleGraphErrorCode;
  constructor(code: LifecycleGraphErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceLifecycleValidationError";
    this.code = code;
  }
}

export class WorkspaceThemeValidationError extends WorkspaceSdkValidationErrorBase {
  readonly code: WorkspaceThemeValidationErrorCode;
  constructor(code: WorkspaceThemeValidationErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceThemeValidationError";
    this.code = code;
  }
}

export type WorkspaceSdkValidationError =
  | WorkspacePluginShapeError
  | WorkspaceRegistryValidationError
  | WorkspaceRuleSetValidationError
  | WorkspaceWizardValidationError
  | WorkspaceHooksValidationError
  | WorkspaceLifecycleValidationError
  | WorkspaceThemeValidationError;

const SHAPE_CODES = new Set<string>(["PLUGIN_INVALID_SHAPE", "PLUGIN_FUNCTION_NOT_ALLOWED"]);
const REGISTRY_CODES = new Set<string>([
  "UNKNOWN_FIELD_ID",
  "DUPLICATE_FIELD_ID",
  "DUPLICATE_CANONICAL_PATH",
  "INVALID_FIELD_REGISTRY",
]);
const RULE_SET_CODES = new Set<string>(["DUPLICATE_CELL_ID", "INVALID_RULE_SET"]);
const WIZARD_CODES = new Set<string>(["INVALID_WIZARD_SURFACE"]);
const HOOKS_CODES = new Set<string>(["INVALID_VALIDATION_HOOKS"]);
const LIFECYCLE_CODES = new Set<string>([
  "INVALID_LIFECYCLE",
  "CYCLE_DETECTED",
  "UNREACHABLE_PUBLISH",
  "ORPHAN_STATE",
]);
const THEME_CODES = new Set<string>([
  "TENANT_INVALID_SHAPE",
  "INVALID_THEME_ID",
  "INVALID_THEME_VERSION",
  "THEME_CSS_VARIABLE_LIMIT",
  "INVALID_THEME_CSS_KEY",
  "INVALID_THEME_CSS_VALUE",
  "UNSAFE_THEME_CSS_VALUE",
  "INVALID_THEME_STYLESHEET",
  "UNSEALED_THEME",
]);

export function throwWorkspaceValidationError(
  code: WorkspaceSdkValidationErrorCode,
  message: string,
  options?: { readonly cause?: { readonly domain: "canonical"; readonly code: string } },
): never {
  if (SHAPE_CODES.has(code)) {
    throw new WorkspacePluginShapeError(code as WorkspacePluginShapeErrorCode, message);
  }
  if (REGISTRY_CODES.has(code)) {
    throw new WorkspaceRegistryValidationError(
      code as WorkspaceRegistryValidationErrorCode,
      message,
      options?.cause,
    );
  }
  if (RULE_SET_CODES.has(code)) {
    throw new WorkspaceRuleSetValidationError(code as WorkspaceRuleSetValidationErrorCode, message);
  }
  if (WIZARD_CODES.has(code)) {
    throw new WorkspaceWizardValidationError(code as WorkspaceWizardValidationErrorCode, message);
  }
  if (HOOKS_CODES.has(code)) {
    throw new WorkspaceHooksValidationError(code as WorkspaceHooksValidationErrorCode, message);
  }
  if (LIFECYCLE_CODES.has(code)) {
    throw new WorkspaceLifecycleValidationError(code as LifecycleGraphErrorCode, message);
  }
  if (THEME_CODES.has(code)) {
    throw new WorkspaceThemeValidationError(code as WorkspaceThemeValidationErrorCode, message);
  }
  throw new WorkspacePluginShapeError("PLUGIN_INVALID_SHAPE", `Unknown validation code: ${code}`);
}

export function isWorkspaceSdkValidationError(
  error: unknown,
): error is WorkspaceSdkValidationError {
  return (
    error instanceof WorkspacePluginShapeError ||
    error instanceof WorkspaceRegistryValidationError ||
    error instanceof WorkspaceRuleSetValidationError ||
    error instanceof WorkspaceWizardValidationError ||
    error instanceof WorkspaceHooksValidationError ||
    error instanceof WorkspaceLifecycleValidationError ||
    error instanceof WorkspaceThemeValidationError
  );
}

export function workspaceSdkValidationErrorCode(
  error: WorkspaceSdkValidationError,
): WorkspaceSdkValidationErrorCode {
  return error.code;
}
