/**
 * Shared Zod safeParse → throw shape used by guest registration POST parsers (DG-3.5).
 * Avoids importing `zod` into the helper — callers pass `schema.safeParse(input)`.
 */

export type WorkspaceZodSafeParseSuccess<T> = {
  readonly success: true;
  readonly data: T;
};

export type WorkspaceZodSafeParseFailure = {
  readonly success: false;
  readonly error: {
    readonly flatten: () => unknown;
  };
};

export type WorkspaceZodSafeParseResult<T> =
  | WorkspaceZodSafeParseSuccess<T>
  | WorkspaceZodSafeParseFailure;

/**
 * Return parsed data or throw `Error("ZOD_VALIDATION_FAILED")` with `.details` from flatten().
 */
export function parseWorkspaceZodOrThrow<T>(
  parsed: WorkspaceZodSafeParseResult<T>,
): T {
  if (!parsed.success) {
    const err = new Error("ZOD_VALIDATION_FAILED") as Error & { details?: unknown };
    err.details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}
