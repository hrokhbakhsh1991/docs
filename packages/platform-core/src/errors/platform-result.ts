import { PlatformCoreError, type PlatformCoreErrorCode } from "./platform-core.error";

/**
 * Platform error model (Phase 1):
 * - **Bootstrap / ingress:** `PlatformResult<T>` — engines, `tryFromPlugin`, `tryInit`.
 * - **Field validation:** `ValidationResult` — violations[], not throws.
 * - **Public facade throws:** `init()` / `buildRenderPlan()` only — via `unwrapPlatformResult` (not exported).
 * - **Internal hot paths** may throw `PlatformCoreError`; callers map to `PlatformResult` at boundaries.
 */

/** Discriminated result — bootstrap branches return this instead of throwing. */
export type PlatformResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PlatformCoreError };

export function platformOk<T>(value: T): PlatformResult<T> {
  return { ok: true, value };
}

export function platformErr<T>(error: PlatformCoreError): PlatformResult<T> {
  return { ok: false, error };
}

export function platformFail<T>(
  code: PlatformCoreErrorCode,
  message: string,
  details?: PlatformCoreError["details"],
): PlatformResult<T> {
  return platformErr(new PlatformCoreError(code, message, details));
}

export function unwrapPlatformResult<T>(result: PlatformResult<T>): T {
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

export function isPlatformCoreError(error: unknown): error is PlatformCoreError {
  return error instanceof PlatformCoreError;
}
