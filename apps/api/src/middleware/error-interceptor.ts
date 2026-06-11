import type { ServerResponse } from "node:http";

import { isCanonicalSyncValidationError } from "../canonical/canonical-sync-validation-error";
import { isSchemaVersionMismatchError } from "../canonical/schema-version-mismatch";
import {
  isValidationTimeBudgetExceededError,
  VALIDATION_TIME_BUDGET_EXCEEDED,
} from "../canonical/validation-time-budget";
import {
  isValidationQueueSaturatedError,
  VALIDATION_QUEUE_SATURATED,
} from "../canonical/validation-queue-saturated";
import {
  DB_POOL_SATURATED,
  isDbPoolSaturatedError,
  readDbPoolSaturatedRetryAfterSec,
} from "../db/pool-saturation";
import { recordDbPoolSaturatedResponse } from "../db/pool-saturation-monitor";
import {
  isTenantDbBudgetExceededError,
  TENANT_DB_BUDGET_EXCEEDED,
} from "../db/tenant-connection-budget";
import { isTourVersionConflictError } from "../tours/tour-version-conflict";
import { isValidationFailure, type ValidationFailure } from "../canonical/validation-failure";
import {
  IDEMPOTENCY_IN_PROGRESS,
  IDEMPOTENCY_KEY_REQUIRED,
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  HTTP_IDEMPOTENCY_TENANT_MISMATCH,
} from "../http/http-idempotency";
import { WorkspaceInvalidError } from "../tenant/workspace-membership";
import { sendJson, isMalformedJsonBodyError, INVALID_JSON } from "../http/json";
import { isResponseTooLargeError, RESPONSE_TOO_LARGE } from "../http/http-response-size-budget";
import {
  recordHttpRequestBodyRejected,
  recordHttpResponseBodyRejected,
} from "../http/http-json-pressure-monitor";
import { isRequestBodyTooLargeError, REQUEST_BODY_TOO_LARGE } from "../http/request-body-limit";
import { isPriorityLoadShedError, PRIORITY_LOAD_SHED } from "../http/weighted-fair-admission";
import {
  isTourWriteConcurrencyExceededError,
  TOUR_WRITE_CONCURRENCY_EXCEEDED,
} from "../http/tour-write-concurrency-budget";
import { ProvisioningDevOnlyError } from "../internal/provisioning-guard";
import { TenantProvisionConflictError } from "../internal/provisioning.errors";
import {
  OutboxReplayNotFailedError,
  OutboxReplayNotFoundError,
  OutboxReplayTenantMismatchError,
} from "../outbox/outbox-replay";
import { logger } from "../observability/logger";
import {
  acquireInternalErrorLogSlot,
  bindInternalErrorLogSuppressedSummary,
  readSuppressedInternalErrorCount,
} from "../observability/internal-error-log-budget";
import { hashTenantIdForLog, resolveInternalErrorCode } from "../observability/log-safety";
import { metricsRegistry } from "../observability/metrics";
import { requireActiveTraceId } from "../observability/trace-request-context";
import { getActiveTenantId } from "../tenant/tenant-request-context";
import {
  isRateLimiterRedisUnavailableError,
  sendTenantRateLimitExceeded,
  TenantRateLimitExceededError,
} from "./tenant-rate-limiter";
import {
  isUrbanOwnerRequiredError,
  isUrbanRegistrationClosedError,
  isUrbanRegistrationDuplicateError,
  isUrbanWorkspaceRequiredError,
  URBAN_OWNER_REQUIRED,
  URBAN_REGISTRATION_CLOSED,
  URBAN_REGISTRATION_DUPLICATE,
  URBAN_WORKSPACE_REQUIRED,
} from "@app-tour/workspace-urban/http";
import {
  DENALI_REGISTRATION_DUPLICATE,
  isDenaliRegistrationDuplicateError,
} from "@app-tour/workspace-denali/http";
import {
  isAuthTokenRevokedError,
  isIdentityRequiredError,
  isOtpInvalidError,
} from "../identity/identity.errors";
import { DbCircuitOpenError } from "../db/transient-db-error";
import { ProxyCircuitOpenError } from "../proxy/proxy-upstream-circuit";
import {
  isProxyUpstreamTimeoutError,
  ProxyUpstreamTimeoutError,
} from "../proxy/proxy-upstream-timeout";
import { isTransientDbError } from "../db/transient-db-error";

export const CORRELATION_ID_HEADER = "x-correlation-id";

bindInternalErrorLogSuppressedSummary(() => {
  logger.warn(
    {
      event: "http.error.internal.suppressed",
      suppressed: readSuppressedInternalErrorCount(),
      windowMs: 1000,
    },
    "internal error logs suppressed during burst"
  );
});

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

/** Active trace ALS id — fail-closed when trace was not bound (DEC-126 / TRACE-REGEN-02). */
export function resolveCorrelationId(): string {
  return requireActiveTraceId();
}

export function sendHttpError(
  res: ServerResponse,
  status: number,
  body: { readonly error: string; readonly code?: string },
  correlationId: string = resolveCorrelationId(),
  retryAfterSec?: number
): void {
  if (res.writableEnded) {
    return;
  }
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  if (retryAfterSec !== undefined && retryAfterSec > 0) {
    res.setHeader("Retry-After", String(retryAfterSec));
  }
  const envelope: HttpErrorBody = { ...body, correlationId };
  sendJson(res, status, envelope);
}

function sendServiceUnavailable(
  res: ServerResponse,
  correlationId: string,
  retryAfterSec = 1
): void {
  sendHttpError(res, 503, { error: "service_unavailable" }, correlationId, retryAfterSec);
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
  if (message.startsWith("URBAN_REGISTRATION_INVALID")) return 400;
  if (message.startsWith("URBAN_REGISTRATION_INVALID")) return 400;
  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) return 400;
  if (message.startsWith("SCHEMA_VERSION_MISMATCH")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_BOUND")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_FOUND")) return 500;
  if (message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) return 409;
  if (message.startsWith("TOUR_VERSION_CONFLICT")) return 409;
  if (message.startsWith("TOUR_NOT_FOUND")) return 404;
  if (message.startsWith("TOUR_CLONE_UNSUPPORTED")) return 422;
  if (message.startsWith("DENALI_PHOTO_REMINT_DEST_FORBIDDEN")) return 403;
  if (message.startsWith("FINANCE_WORKSPACE_UNSUPPORTED")) return 404;
  if (message.startsWith("FINANCE_PAYMENT_NOT_FOUND")) return 404;
  if (message.startsWith("FINANCE_RECEIPT_NOT_FOUND")) return 404;
  if (message.startsWith("TOUR_CAPACITY_EXCEEDED")) return 429;
  if (message === VALIDATION_QUEUE_SATURATED) return 429;
  if (message === TOUR_WRITE_CONCURRENCY_EXCEEDED) return 429;
  if (message.startsWith("DUAL_WRITE_FORBIDDEN")) return 403;
  if (message.startsWith("DB_POOL_SATURATED")) return 503;
  if (message.startsWith("DB_TRANSIENT_UNAVAILABLE")) return 503;
  if (message.startsWith("DB_CIRCUIT_OPEN")) return 503;
  if (message === TENANT_DB_BUDGET_EXCEEDED) return 503;
  if (message.startsWith("RATE_LIMIT_EXCEEDED")) return 429;
  if (message === "RATE_LIMITER_REDIS_UNAVAILABLE") return 503;
  if (message === VALIDATION_TIME_BUDGET_EXCEEDED) return 408;
  if (message === IDEMPOTENCY_PAYLOAD_MISMATCH || message === IDEMPOTENCY_IN_PROGRESS) {
    return 409;
  }
  if (message === IDEMPOTENCY_KEY_REQUIRED) return 400;
  if (message === URBAN_REGISTRATION_DUPLICATE) return 409;
  if (message === URBAN_REGISTRATION_CLOSED) return 403;
  if (message === DENALI_REGISTRATION_DUPLICATE) return 409;
  if (message === HTTP_IDEMPOTENCY_TENANT_MISMATCH) {
    return 403;
  }
  if (message.startsWith("PROVISIONING_TENANT_ID_REQUIRED")) return 400;
  if (message.startsWith("PROVISIONING_TENANT_ID_INVALID_UUID")) return 400;
  if (message.startsWith("PROVISIONING_TENANT_ID_MISMATCH")) return 400;
  if (message.startsWith("OUTBOX_REPLAY_BODY_INVALID")) return 400;
  if (message.startsWith("OUTBOX_REPLAY_TENANT_ID_REQUIRED")) return 400;
  return 500;
}

function logInternalServerError(error: unknown, correlationId: string): void {
  if (!acquireInternalErrorLogSlot()) {
    metricsRegistry.increment("http_internal_error_log_suppressed_total");
    return;
  }
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

  if (isDbPoolSaturatedError(error)) {
    recordDbPoolSaturatedResponse();
    sendHttpError(
      res,
      503,
      { error: "service_unavailable", code: DB_POOL_SATURATED },
      correlationId,
      readDbPoolSaturatedRetryAfterSec(error)
    );
    return;
  }

  if (isTenantDbBudgetExceededError(error)) {
    sendHttpError(
      res,
      503,
      { error: "tenant_db_budget_exceeded", code: TENANT_DB_BUDGET_EXCEEDED },
      correlationId,
      readDbPoolSaturatedRetryAfterSec(error)
    );
    return;
  }

  if (isPriorityLoadShedError(error)) {
    sendHttpError(
      res,
      503,
      { error: "service_unavailable", code: PRIORITY_LOAD_SHED },
      correlationId,
      error.retryAfterSec
    );
    return;
  }

  if (isValidationTimeBudgetExceededError(error)) {
    sendHttpError(
      res,
      408,
      { error: "validation_time_budget_exceeded", code: VALIDATION_TIME_BUDGET_EXCEEDED },
      correlationId
    );
    return;
  }

  if (isTourWriteConcurrencyExceededError(error)) {
    sendHttpError(
      res,
      429,
      {
        error: "tour_write_concurrency_exceeded",
        code: TOUR_WRITE_CONCURRENCY_EXCEEDED,
      },
      correlationId
    );
    return;
  }

  if (isValidationQueueSaturatedError(error)) {
    sendHttpError(
      res,
      429,
      { error: "validation_queue_saturated", code: VALIDATION_QUEUE_SATURATED },
      correlationId
    );
    return;
  }

  if (error instanceof TenantRateLimitExceededError) {
    sendTenantRateLimitExceeded(res, error.retryAfterMs, correlationId);
    return;
  }

  if (isRateLimiterRedisUnavailableError(error)) {
    sendHttpError(
      res,
      503,
      { error: "rate_limiter_redis_unavailable", code: error.code },
      correlationId
    );
    return;
  }

  if (isRequestBodyTooLargeError(error)) {
    recordHttpRequestBodyRejected();
    sendHttpError(
      res,
      413,
      { error: "payload_too_large", code: REQUEST_BODY_TOO_LARGE },
      correlationId
    );
    return;
  }

  if (isResponseTooLargeError(error)) {
    recordHttpResponseBodyRejected();
    sendHttpError(
      res,
      507,
      { error: "response_too_large", code: RESPONSE_TOO_LARGE },
      correlationId
    );
    return;
  }

  if (isMalformedJsonBodyError(error)) {
    sendHttpError(res, 400, { error: "invalid_json", code: INVALID_JSON }, correlationId);
    return;
  }

  if (error instanceof ProxyCircuitOpenError) {
    sendHttpError(res, 503, { error: "proxy_circuit_open", code: error.code }, correlationId);
    return;
  }

  if (error instanceof DbCircuitOpenError) {
    sendHttpError(
      res,
      503,
      { error: "service_unavailable", code: error.code },
      correlationId,
      error.retryAfterSec
    );
    return;
  }

  if (isTransientDbError(error)) {
    sendServiceUnavailable(res, correlationId, 1);
    return;
  }

  if (isProxyUpstreamTimeoutError(error) || error instanceof ProxyUpstreamTimeoutError) {
    sendHttpError(
      res,
      504,
      { error: "proxy_upstream_timeout", code: "PROXY_UPSTREAM_TIMEOUT" },
      correlationId
    );
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

  if (isIdentityRequiredError(error)) {
    sendHttpError(res, 401, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (isOtpInvalidError(error)) {
    sendHttpError(res, 401, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (isAuthTokenRevokedError(error)) {
    sendHttpError(res, 401, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (isUrbanOwnerRequiredError(error)) {
    sendHttpError(
      res,
      403,
      { error: URBAN_OWNER_REQUIRED, code: URBAN_OWNER_REQUIRED },
      correlationId
    );
    return;
  }

  if (isUrbanWorkspaceRequiredError(error)) {
    sendHttpError(
      res,
      404,
      { error: URBAN_WORKSPACE_REQUIRED, code: URBAN_WORKSPACE_REQUIRED },
      correlationId
    );
    return;
  }

  if (isUrbanRegistrationDuplicateError(error)) {
    sendHttpError(
      res,
      409,
      { error: URBAN_REGISTRATION_DUPLICATE, code: URBAN_REGISTRATION_DUPLICATE },
      correlationId
    );
    return;
  }

  if (isUrbanRegistrationClosedError(error)) {
    sendHttpError(
      res,
      403,
      { error: URBAN_REGISTRATION_CLOSED, code: URBAN_REGISTRATION_CLOSED },
      correlationId
    );
    return;
  }

  if (isDenaliRegistrationDuplicateError(error)) {
    sendHttpError(
      res,
      409,
      { error: DENALI_REGISTRATION_DUPLICATE, code: DENALI_REGISTRATION_DUPLICATE },
      correlationId
    );
    return;
  }

  if (error instanceof Error && error.message === "INTERNAL_SERVER_ERROR") {
    logInternalServerError(error, correlationId);
    sendHttpError(res, 500, { error: "INTERNAL_SERVER_ERROR" }, correlationId);
    return;
  }

  if (error instanceof ProvisioningDevOnlyError) {
    sendHttpError(res, 403, { error: error.message, code: error.code }, correlationId);
    return;
  }

  if (error instanceof TenantProvisionConflictError) {
    sendHttpError(res, 409, { error: error.code, code: error.code }, correlationId);
    return;
  }

  if (error instanceof OutboxReplayNotFoundError) {
    sendHttpError(res, 404, { error: error.code, code: error.code }, correlationId);
    return;
  }

  if (error instanceof OutboxReplayTenantMismatchError) {
    sendHttpError(res, 403, { error: error.code, code: error.code }, correlationId);
    return;
  }

  if (error instanceof OutboxReplayNotFailedError) {
    sendHttpError(res, 409, { error: error.code, code: error.code }, correlationId);
    return;
  }

  const message = error instanceof Error ? error.message : "unknown_error";
  const status = mapErrorMessageToStatus(message);

  if (status === 503) {
    sendServiceUnavailable(res, correlationId, 1);
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
