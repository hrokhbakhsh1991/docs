export const APP_ERROR_CODES = [
  "TENANT_RESOLUTION_FAILED",
  "TENANT_HOST_UNKNOWN",
  "TENANT_HOST_TOKEN_MISMATCH",
  "AUTH_SESSION_INVALID",
  "CAPABILITY_DENIED",
  "RBAC_FORBIDDEN",
  "VALIDATION_FAILED",
  "API_UPSTREAM_FAILED",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type AppErrorContext = Record<string, string | number | boolean | undefined>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly context: AppErrorContext;

  constructor(code: AppErrorCode, message: string, context: AppErrorContext = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
  }
}

export function createAppError(
  code: AppErrorCode,
  message: string,
  context?: AppErrorContext,
): AppError {
  return new AppError(code, message, context ?? {});
}

export function normalizeAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if ((APP_ERROR_CODES as readonly string[]).includes(code)) {
      return new AppError(code as AppErrorCode, error instanceof Error ? error.message : code, {});
    }
  }
  return createAppError("API_UPSTREAM_FAILED", error instanceof Error ? error.message : "Unknown error");
}
