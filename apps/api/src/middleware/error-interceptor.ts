import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";

import { isCanonicalSyncValidationError } from "../canonical/canonical-sync-validation-error";
import { isSchemaVersionMismatchError } from "../canonical/schema-version-mismatch";
import { isTourVersionConflictError } from "../tours/tour-version-conflict";
import { isValidationFailure, type ValidationFailure } from "../canonical/validation-failure";
import {
  IDEMPOTENCY_IN_PROGRESS,
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  HTTP_IDEMPOTENCY_TENANT_MISMATCH,
} from "../http/http-idempotency";
import { WorkspaceInvalidError } from "../tenant/workspace-membership";
import { sendJson } from "../http/json";
import { logger } from "../observability/logger";
import { hashTenantIdForLog, resolveInternalErrorCode } from "../observability/log-safety";
import { getActiveTraceId } from "../observability/trace-request-context";
import { getActiveTenantId } from "../tenant/tenant-request-context";
import { sendTenantRateLimitExceeded, TenantRateLimitExceededError } from "./tenant-rate-limiter";

export const CORRELATION_ID_HEADER = "x-correlation-id";

export type HttpErrorBody = {
  readonly error: string;
  readonly code?: string;
  readonly correlationId: string;
};

type AuthContextErrorLike = Error & { readonly code: string };

function isInvalidTenantAuthContextError(error: unknown): error is AuthContextErrorLike {
  return (
    error instanceof Error &&
    error.name === "InvalidTenantAuthContextError" &&
    "code" in error &&
    typeof (error as AuthContextErrorLike).code === "string"
  );
}

/** Active trace ALS id, or a fresh UUID when trace was not bound. */
export function resolveCorrelationId(): string {
  return getActiveTraceId() ?? randomUUID();
}

export function sendHttpError(
  res: ServerResponse,
  status: number,
  body: { readonly error: string; readonly code?: string },
  correlationId: string = resolveCorrelationId()
): void {
  if (res.writableEnded) {
    return;
  }
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  const envelope: HttpErrorBody = { ...body, correlationId };
  sendJson(res, status, envelope);
}

function clientSafeValidationMessage(failure: ValidationFailure): string {
  const message = failure.message.trim();
  if (message.length === 0) {
    return "validation_failed";
  }
  return message;
}

function mapErrorMessageToStatus(message: string): number {
  if (message.startsWith("UNAUTHORIZED_")) return 401;
  if (message.startsWith("FORBIDDEN_")) return 403;
  if (message.startsWith("INVALID_TENANT_AUTH_CONTEXT")) return 401;
  if (message.startsWith("ZOD_VALIDATION_FAILED")) return 400;
  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_BOUND")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_FOUND")) return 500;
  if (message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) return 409;
  if (message.startsWith("TOUR_VERSION_CONFLICT")) return 409;
  if (message.startsWith("TOUR_NOT_FOUND")) return 404;
  if (message.startsWith("TOUR_CAPACITY_EXCEEDED")) return 429;
  if (message.startsWith("DUAL_WRITE_FORBIDDEN")) return 403;
  if (message.startsWith("DB_POOL_SATURATED")) return 503;
  if (message.startsWith("RATE_LIMIT_EXCEEDED")) return 429;
  if (message === IDEMPOTENCY_PAYLOAD_MISMATCH || message === IDEMPOTENCY_IN_PROGRESS) {
    return 409;
  }
  if (message === HTTP_IDEMPOTENCY_TENANT_MISMATCH) {
    return 403;
  }
  return 500;
}

function logInternalServerError(error: unknown, correlationId: string): void {
  logger.error(
    {
      event: "http.error.internal",
      correlation_id: correlationId,
      tenant_hash: hashTenantIdForLog(getActiveTenantId()),
      error_code: resolveInternalErrorCode(error),
    },
    "unhandled request error"
  );
}

/**
 * Maps thrown errors to client-safe HTTP envelopes with correlation id echo.
 * Never serializes stack, SQL, or engine paths in the response body.
 * ValidationFailure / SchemaVersionMismatchError: 400 only — never logged (DEC-038).
 */
export function handleHttpError(res: ServerResponse, error: unknown): void {
  const correlationId = resolveCorrelationId();

  if (isCanonicalSyncValidationError(error)) {
    sendHttpError(res, 409, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (isTourVersionConflictError(error)) {
    sendHttpError(res, 409, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (isSchemaVersionMismatchError(error)) {
    sendHttpError(res, 400, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (isValidationFailure(error)) {
    sendHttpError(
      res,
      400,
      { error: clientSafeValidationMessage(error), code: error.code },
      correlationId
    );
    return;
  }

  if (error instanceof TenantRateLimitExceededError) {
    sendTenantRateLimitExceeded(res, error.retryAfterMs, correlationId);
    return;
  }

  if (isInvalidTenantAuthContextError(error)) {
    sendHttpError(res, 401, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (error instanceof WorkspaceInvalidError) {
    sendHttpError(
      res,
      401,
      { error: "WORKSPACE_INVALID", code: "WORKSPACE_INVALID" },
      correlationId
    );
    return;
  }

  const message = error instanceof Error ? error.message : "unknown_error";
  const status = mapErrorMessageToStatus(message);

  if (status === 503) {
    sendHttpError(res, 503, { error: "service_unavailable" }, correlationId);
    return;
  }

  if (status === 500) {
    logInternalServerError(error, correlationId);
    sendHttpError(res, 500, { error: "internal_error" }, correlationId);
    return;
  }

  if (status === 409 && !message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) {
    sendHttpError(res, 409, { error: message, code: message }, correlationId);
    return;
  }

  sendHttpError(res, status, { error: message, code: message }, correlationId);
}
