import type { ServerResponse } from "node:http";

import { handleHttpError } from "../../middleware/error-interceptor.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";

/** Maps platform auth failures to fixed 401/403 envelopes (no err.message). */
export function respondPlatformAuthError(res: ServerResponse, err: unknown): boolean {
  if (
    err instanceof PlatformUnauthorized ||
    (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED"
  ) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
    return true;
  }
  if (err instanceof PlatformForbidden || (err as { code?: string })?.code === "PLATFORM_FORBIDDEN") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return true;
  }
  return false;
}

/** Maps platform validation failures to 422 (no err.message). */
export function respondPlatformValidationError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
    return true;
  }
  return false;
}

/**
 * Fail-closed platform route catch — Prisma P2002→409, P2003→422 via handleHttpError;
 * unmapped engine errors → opaque 500 (logged server-side only, no stack to client).
 */
export function handlePlatformRouteError(res: ServerResponse, err: unknown): void {
  if (respondPlatformAuthError(res, err)) {
    return;
  }
  if (respondPlatformValidationError(res, err)) {
    return;
  }
  handleHttpError(res, err);
}
