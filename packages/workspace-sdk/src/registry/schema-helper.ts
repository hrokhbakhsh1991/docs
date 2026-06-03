import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";
import type { WorkspaceSdkValidationErrorCode } from "../errors/workspace-validation-errors.js";

export type Violation = {
  readonly code: WorkspaceSdkValidationErrorCode;
  readonly message: string;
  readonly cause?: { readonly domain: "canonical"; readonly code: string };
};

export function violation(
  code: WorkspaceSdkValidationErrorCode,
  message: string,
  cause?: { readonly domain: "canonical"; readonly code: string },
): Violation {
  return { code, message, cause };
}

export function fail<T>(v: Violation): SdkResult<T, WorkspaceSdkValidationErrorCode> {
  return v.cause
    ? sdkErr(v.code, v.message, v.cause)
    : sdkErr(v.code, v.message);
}

export function violationFromCanonicalPathFailure(
  _path: string,
  canonicalCode: string,
  message: string,
): Violation {
  return violation("INVALID_FIELD_REGISTRY", message, {
    domain: "canonical",
    code: canonicalCode,
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function requirePlainObject(
  value: unknown,
  label: string,
  code: WorkspaceSdkValidationErrorCode = "INVALID_FIELD_REGISTRY",
): SdkResult<Record<string, unknown>, WorkspaceSdkValidationErrorCode> {
  if (!isPlainObject(value)) {
    return fail(violation(code, `${label} must be a plain object`));
  }
  return sdkOk(value);
}

export function requireFiniteNumber(
  value: unknown,
  label: string,
  code: WorkspaceSdkValidationErrorCode,
): SdkResult<number, WorkspaceSdkValidationErrorCode> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(violation(code, `${label} must be a finite number`));
  }
  return sdkOk(value);
}

export function requireNonEmptyString(
  value: unknown,
  label: string,
  code: WorkspaceSdkValidationErrorCode,
): SdkResult<string, WorkspaceSdkValidationErrorCode> {
  if (typeof value !== "string" || value.length === 0) {
    return fail(violation(code, `${label} must be a non-empty string`));
  }
  return sdkOk(value);
}

export function requireArray(
  value: unknown,
  label: string,
  code: WorkspaceSdkValidationErrorCode,
): SdkResult<unknown[], WorkspaceSdkValidationErrorCode> {
  if (!Array.isArray(value)) {
    return fail(violation(code, `${label} must be an array`));
  }
  return sdkOk(value);
}

export function requireBoolean(
  value: unknown,
  label: string,
  code: WorkspaceSdkValidationErrorCode,
): SdkResult<boolean, WorkspaceSdkValidationErrorCode> {
  if (typeof value !== "boolean") {
    return fail(violation(code, `${label} must be a boolean`));
  }
  return sdkOk(value);
}

export function requireOneOf<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  label: string,
  code: WorkspaceSdkValidationErrorCode,
): SdkResult<T, WorkspaceSdkValidationErrorCode> {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    return fail(violation(code, `${label} is invalid`));
  }
  return sdkOk(value as T);
}

export function chain<T>(
  result: SdkResult<T, WorkspaceSdkValidationErrorCode>,
  next: (value: T) => SdkResult<T, WorkspaceSdkValidationErrorCode>,
): SdkResult<T, WorkspaceSdkValidationErrorCode> {
  return result.ok ? next(result.value) : result;
}
