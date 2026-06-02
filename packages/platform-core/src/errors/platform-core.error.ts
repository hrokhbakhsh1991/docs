export type PlatformCoreErrorCode =
  | "UNKNOWN_FIELD_ID"
  | "DUPLICATE_FIELD_ID"
  | "DUPLICATE_CELL_ID"
  | "DUPLICATE_CANONICAL_PATH"
  | "INVALID_FIELD_REGISTRY"
  | "INVALID_RULE_SET"
  | "INVALID_WIZARD_SURFACE"
  | "INVALID_VALIDATION_HOOKS"
  | "INVALID_LIFECYCLE"
  | "INVALID_RULE_CONTEXT"
  | "TENANT_ISOLATION_VIOLATION"
  | "PLUGIN_INVALID_SHAPE"
  | "UNKNOWN_CANONICAL_PATH"
  | "CANONICAL_TYPE_MISMATCH"
  | "REQUIRED_FIELD_EMPTY"
  | "CANONICAL_ROOT_UNKNOWN"
  | "RULE_CONTEXT_UNMATCHED"
  | "AMBIGUOUS_RULE_RESOLUTION";

export type PlatformCoreErrorDetails = Readonly<Record<string, unknown>>;

export class PlatformCoreError extends Error {
  readonly code: PlatformCoreErrorCode;
  readonly details?: PlatformCoreErrorDetails;

  constructor(
    code: PlatformCoreErrorCode,
    message: string,
    details?: PlatformCoreErrorDetails,
  ) {
    super(message);
    this.name = "PlatformCoreError";
    this.code = code;
    this.details = details;
  }
}
