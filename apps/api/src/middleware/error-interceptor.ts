import type { ServerResponse } from "node:http";

import { Prisma } from "@prisma/client";

import { isPrismaErrorOfType } from "../db/prisma-error-instance";

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
import {
  isWorkspaceTypeUnresolvedError,
  WORKSPACE_TYPE_UNRESOLVED,
} from "../tenant/resolve-workspace-type";
import {
  FINANCE_WORKSPACE_UNSUPPORTED,
  isFinanceWorkspaceUnsupportedError,
} from "../workspace-finance/resolve-finance-workspace-type-for-tenant";
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
import {
  TenantProvisionConflictError,
  WorkspaceNotCertifiedForProductionError,
} from "../internal/provisioning.errors";
import {
  OutboxReplayNotFailedError,
  OutboxReplayNotFoundError,
  OutboxReplayTenantMismatchError,
} from "../outbox/outbox-replay";
import {
  OutboxReplayConfirmRequiredError,
  OutboxReplayInputError,
} from "../outbox/outbox-prod-replay";
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
  resolveWorkspaceHttpErrorCodeStatus,
  WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS,
} from "./workspace-http-error-map.generated";
import {
  isAuthTokenRevokedError,
  isIdentityRequiredError,
  isOtpInvalidError,
} from "../identity/identity.errors";
import { ImpersonationReadOnlyError } from "../identity/impersonation-read-only.error";
import { isWorkspaceCommerceGatewayBlockedError } from "../workspace-metadata/assert-workspace-commerce-gateway-blocked.ts";
import { resolveBookingHttpError } from "../bookings/booking-http-error-map";
import {
  isPaymentsWebhookSignatureInvalidError,
  isPaymentsWebhookSignatureMissingError,
  isPaymentsWebhookSigningSecretNotConfiguredError,
  isPaymentsWebhookSourceIpBlockedError,
  isPaymentsWebhookTimestampSkewError,
} from "../integrations/webhooks/webhook.errors.ts";
import { isPaymentsWebhookEventIdRequiredError } from "../integrations/webhooks/payments-webhook-event-id-required.error.ts";
import { isPaidTourOpenGateBlockedError } from "../registrations/assert-paid-tour-open-gate.ts";
import { isPublicRegistrationThrottleExceededError } from "../registrations/public-registration-throttle.ts";
import { isRegistrationCapacityExceededError } from "../registrations/registration-capacity.service.ts";
import { DbCircuitOpenError } from "../db/transient-db-error";
import { ProxyCircuitOpenError } from "../proxy/proxy-upstream-circuit";
import {
  isProxyUpstreamTimeoutError,
  ProxyUpstreamTimeoutError,
} from "../proxy/proxy-upstream-timeout";
import { DATABASE_UNAVAILABLE, isDatabaseConnectionError } from "../db/database-connection-error";
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

export type MappedAppError = {
  readonly status: number;
  readonly error: string;
  readonly code: string;
};

/** AP14 — opaque domain tokens only (no engine text, no spaces). */
export function isClientSafeErrorToken(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return false;
  }
  if (/\s/.test(trimmed)) {
    return false;
  }
  return /^[A-Za-z0-9_]+$/.test(trimmed);
}

/** AP14 — normalize known Prisma request errors before generic message fallback. */
export function mapPrismaErrorToAppError(error: unknown): MappedAppError | null {
  if (
    !isPrismaErrorOfType<Prisma.PrismaClientKnownRequestError>(
      error,
      Prisma.PrismaClientKnownRequestError
    )
  ) {
    return null;
  }
  switch (error.code) {
    case "P2002":
      return { status: 409, error: "conflict", code: "UNIQUE_CONSTRAINT_VIOLATION" };
    case "P2003":
      return { status: 422, error: "foreign_key_violation", code: "FOREIGN_KEY_VIOLATION" };
    case "P2025":
      return { status: 404, error: "not_found", code: "RECORD_NOT_FOUND" };
    default:
      return null;
  }
}

function resolvePrefixedValidationCode(message: string): string | undefined {
  if (message.startsWith("ZOD_VALIDATION_FAILED")) {
    return "ZOD_VALIDATION_FAILED";
  }
  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) {
    return "CANONICAL_VALIDATION_FAILED";
  }
  return undefined;
}

export type HttpErrorInput = {
  readonly error: string;
  readonly code?: string;
} & Record<string, unknown>;

export function sendHttpError(
  res: ServerResponse,
  status: number,
  body: HttpErrorInput,
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
  if (message === "BOOKINGS_FORBIDDEN") return 403;
  if (message.startsWith("INVALID_TENANT_AUTH_CONTEXT")) return 401;
  if (message.startsWith("ZOD_VALIDATION_FAILED")) return 400;
  if (message.startsWith("URBAN_REGISTRATION_INVALID")) return 400;
  if (message.startsWith("URBAN_REGISTRATION_INVALID")) return 400;
  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) return 400;
  if (message.startsWith("TOUR_LIFECYCLE_")) return 400;
  if (message.startsWith("SCHEMA_VERSION_MISMATCH")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_BOUND")) return 400;
  if (message.startsWith("WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION")) return 422;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_FOUND")) return 500;
  if (message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) return 409;
  if (message.startsWith("TOUR_VERSION_CONFLICT")) return 409;
  if (message.startsWith("TOUR_NOT_FOUND")) return 404;
  if (message === "TENANT_NOT_FOUND") return 404;
  if (message.startsWith("TOUR_CLONE_UNSUPPORTED")) return 422;
  if (message.startsWith("DENALI_PHOTO_REMINT_DEST_FORBIDDEN")) return 403;
  if (
    message === WORKSPACE_TYPE_UNRESOLVED ||
    message.startsWith(`${WORKSPACE_TYPE_UNRESOLVED}:`)
  ) {
    return 404;
  }
  if (
    message === FINANCE_WORKSPACE_UNSUPPORTED ||
    message.startsWith(`${FINANCE_WORKSPACE_UNSUPPORTED}:`)
  ) {
    return 404;
  }
  if (message.startsWith("BOOKING_WORKSPACE_UNSUPPORTED")) return 404;
  if (message.startsWith("BOOKING_VALIDATION_REJECTED")) return 400;
  if (message.startsWith("BOOKING_VALIDATION_FAILED")) return 400;
  if (message.startsWith("BOOKING_CAPACITY_REJECTED")) return 409;
  if (message === "BOOKING_GUEST_DUPLICATE" || message.startsWith("BOOKING_GUEST_DUPLICATE:"))
    return 409;
  if (message.startsWith("BOOKING_WORKSPACE_TENANT_MISMATCH")) return 403;
  if (message.startsWith("BOOKING_CAPABILITY_VIOLATION")) return 422;
  if (message.startsWith("BOOKING_PUBLIC_CREATE_UNSUPPORTED")) return 403;
  if (message.startsWith("BOOKING_WAITLIST_REQUIRED")) return 409;
  if (message.startsWith("BOOKING_ALREADY_APPROVED")) return 409;
  if (message.startsWith("BOOKING_ALREADY_CANCELLED")) return 409;
  if (message.startsWith("BOOKING_STATUS_CONFLICT")) return 409;
  if (message === "BOOKING_NOT_FOUND" || message.startsWith("BOOKING_NOT_FOUND:")) return 404;
  if (
    message === "BOOKING_FORBIDDEN" ||
    message.startsWith("BOOKING_FORBIDDEN:") ||
    message === "BOOKINGS_OPS_FORBIDDEN" ||
    message === "BOOKINGS_FORBIDDEN"
  ) {
    return 403;
  }
  if (message.startsWith("BULK_APPROVE_BATCH_LIMIT")) return 400;
  if (message.startsWith("FINANCE_PAYMENT_NOT_FOUND")) return 404;
  // PR23-E3 — offline refund operator workflow.
  if (message === "REFUND_NOT_FOUND") return 404;
  if (
    message === "REFUND_REASON_INVALID" ||
    message === "REFUND_INVALID_AMOUNT" ||
    message === "REFUND_SOURCE_INVALID" ||
    message === "REFUND_CURRENCY_MISMATCH"
  ) {
    return 400;
  }
  if (
    message === "REFUND_OVER_CAP" ||
    message === "REFUND_PAYMENT_NOT_PAID" ||
    message === "REFUND_PAYMENT_NOT_MANUAL" ||
    message === "REFUND_NOT_TRANSITIONABLE"
  ) {
    return 409;
  }
  // PR23-A3 — cancel command; NOT_IN_SCOPE collapses to same 404 (no tenant leak).
  if (message === "PAYMENT_NOT_FOUND" || message === "PAYMENT_NOT_IN_SCOPE") return 404;
  if (message === "PAYMENT_CANCEL_REASON_INVALID") return 400;
  if (
    message === "PAYMENT_CANCEL_ONLY_MANUAL" ||
    message === "PAYMENT_NOT_CANCELLABLE" ||
    message === "PAYMENT_HAS_PENDING_RECEIPT"
  ) {
    return 409;
  }
  if (message.startsWith("FINANCE_RECEIPT_NOT_FOUND")) return 404;
  if (message === "FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING") return 409;
  if (message === "FINANCE_RECEIPT_NOT_REQUIRED") return 409;
  if (message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS") return 409;
  if (message === "FINANCE_BOOKING_PAYMENT_SYNC_FAILED") return 409;
  if (message === "FINANCE_BOOKING_PAYMENT_SYNC_COMPENSATE_FAILED") return 500;
  if (message === "FINANCE_PREPAYMENT_CONFLICT") return 409;
  if (message === "FINANCE_APPROVE_CONFLICT") return 409;
  if (message === "FINANCE_DUPLICATE_OBLIGATION_CREDIT") return 409;
  if (message === "FINANCE_LEDGER_CAPTURE_EMPTY") return 422;
  if (message === "FINANCE_OBLIGATION_OVERPAY") return 422;
  if (
    message === "FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT" ||
    message === "FINANCE_RECEIPT_IDEMPOTENCY_CONFLICT"
  ) {
    return 409;
  }
  if (message.startsWith("TOUR_CAPACITY_EXCEEDED")) return 429;
  if (message === VALIDATION_QUEUE_SATURATED) return 429;
  if (message === TOUR_WRITE_CONCURRENCY_EXCEEDED) return 429;
  if (message.startsWith("DUAL_WRITE_FORBIDDEN")) return 403;
  if (message.startsWith("DB_POOL_SATURATED")) return 503;
  if (message === DATABASE_UNAVAILABLE) return 503;
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
  const workspaceCodeStatus = resolveWorkspaceHttpErrorCodeStatus(message);
  if (workspaceCodeStatus !== undefined) {
    return workspaceCodeStatus;
  }
  if (message === HTTP_IDEMPOTENCY_TENANT_MISMATCH) {
    return 403;
  }
  if (message.startsWith("PRODUCTION_")) return 503;
  if (message.endsWith("_FORBIDDEN_IN_PRODUCTION")) return 503;
  if (message === "AUTH_JWT_REQUIRED_IN_PRODUCTION") return 503;
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
  const errMessage =
    error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);
  logger.error(
    {
      event: "http.error.internal",
      correlation_id: correlationId,
      tenant_hash: hashTenantIdForLog(getActiveTenantId()),
      error_code: resolveInternalErrorCode(error),
      // Short message only (no stack) — required to diagnose CI certification 500s.
      err_message: errMessage,
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

  const bookingHttp = resolveBookingHttpError(error);
  if (bookingHttp !== null) {
    sendHttpError(
      res,
      bookingHttp.status,
      {
        error: bookingHttp.error,
        code: bookingHttp.code,
        ...(bookingHttp.maxBatch !== undefined ? { maxBatch: bookingHttp.maxBatch } : {}),
      },
      correlationId
    );
    return;
  }

  if (isWorkspaceTypeUnresolvedError(error)) {
    sendHttpError(
      res,
      404,
      { error: WORKSPACE_TYPE_UNRESOLVED, code: WORKSPACE_TYPE_UNRESOLVED },
      correlationId
    );
    return;
  }

  if (isFinanceWorkspaceUnsupportedError(error)) {
    sendHttpError(
      res,
      404,
      { error: FINANCE_WORKSPACE_UNSUPPORTED, code: FINANCE_WORKSPACE_UNSUPPORTED },
      correlationId
    );
    return;
  }

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

  if (isDatabaseConnectionError(error)) {
    sendHttpError(
      res,
      503,
      { error: "database_unavailable", code: DATABASE_UNAVAILABLE },
      correlationId,
      30
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

  if (error instanceof ImpersonationReadOnlyError) {
    sendHttpError(res, 403, { error: "forbidden", code: "IMPERSONATION_READ_ONLY" }, correlationId);
    return;
  }

  if (isWorkspaceCommerceGatewayBlockedError(error)) {
    sendHttpError(
      res,
      error.statusCode,
      { error: "service_unavailable", code: error.code },
      correlationId
    );
    return;
  }

  if (
    isPaymentsWebhookSignatureMissingError(error) ||
    isPaymentsWebhookTimestampSkewError(error) ||
    isPaymentsWebhookSignatureInvalidError(error)
  ) {
    sendHttpError(
      res,
      error.statusCode,
      { error: "unauthorized", code: error.code },
      correlationId
    );
    return;
  }

  if (isPaymentsWebhookSourceIpBlockedError(error)) {
    sendHttpError(res, error.statusCode, { error: "forbidden", code: error.code }, correlationId);
    return;
  }

  if (isPaymentsWebhookSigningSecretNotConfiguredError(error)) {
    sendHttpError(
      res,
      error.statusCode,
      { error: "service_unavailable", code: error.code },
      correlationId
    );
    return;
  }

  if (isPaymentsWebhookEventIdRequiredError(error)) {
    sendHttpError(res, error.statusCode, { error: "bad_request", code: error.code }, correlationId);
    return;
  }

  if (isRegistrationCapacityExceededError(error)) {
    sendHttpError(res, error.statusCode, { error: "conflict", code: error.code }, correlationId);
    return;
  }

  if (isPublicRegistrationThrottleExceededError(error)) {
    sendHttpError(
      res,
      error.statusCode,
      { error: "rate_limit_exceeded", code: error.code },
      correlationId
    );
    return;
  }

  if (isPaidTourOpenGateBlockedError(error)) {
    sendHttpError(res, error.statusCode, { error: "forbidden", code: error.code }, correlationId);
    return;
  }

  for (const binding of WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS) {
    if (binding.isError(error)) {
      sendHttpError(
        res,
        binding.status,
        { error: binding.code, code: binding.code },
        correlationId
      );
      return;
    }
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

  if (error instanceof WorkspaceNotCertifiedForProductionError) {
    sendHttpError(
      res,
      422,
      {
        error: "workspace_not_certified_for_production",
        code: error.code,
        workspaceType: error.workspaceType,
        pluginId: error.pluginId,
      },
      correlationId
    );
    return;
  }

  if (error instanceof OutboxReplayConfirmRequiredError) {
    sendHttpError(res, 400, { error: error.code, code: error.code }, correlationId);
    return;
  }

  if (error instanceof OutboxReplayInputError) {
    sendHttpError(res, 400, { error: error.message, code: error.code }, correlationId);
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

  const prismaMapped = mapPrismaErrorToAppError(error);
  if (prismaMapped !== null) {
    sendHttpError(
      res,
      prismaMapped.status,
      { error: prismaMapped.error, code: prismaMapped.code },
      correlationId
    );
    return;
  }

  const message = error instanceof Error ? error.message : "unknown_error";
  const status = mapErrorMessageToStatus(message);

  // PR23-A3 — never leak cross-tenant payment existence.
  if (message === "PAYMENT_NOT_IN_SCOPE" || message === "PAYMENT_NOT_FOUND") {
    sendHttpError(
      res,
      404,
      { error: "PAYMENT_NOT_FOUND", code: "PAYMENT_NOT_FOUND" },
      correlationId
    );
    return;
  }

  if (message === "FINANCE_BOOKING_PAYMENT_SYNC_COMPENSATE_FAILED") {
    logInternalServerError(error, correlationId);
    sendHttpError(
      res,
      500,
      {
        error: "FINANCE_BOOKING_PAYMENT_SYNC_COMPENSATE_FAILED",
        code: "FINANCE_BOOKING_PAYMENT_SYNC_COMPENSATE_FAILED",
      },
      correlationId
    );
    return;
  }

  if (status === 503) {
    sendServiceUnavailable(res, correlationId, 1);
    return;
  }

  if (status === 500) {
    logInternalServerError(error, correlationId);
    sendHttpError(res, 500, { error: "internal_error" }, correlationId);
    return;
  }

  const prefixedValidationCode = resolvePrefixedValidationCode(message);
  if (status === 400 && prefixedValidationCode !== undefined) {
    sendHttpError(res, 400, { error: message, code: prefixedValidationCode }, correlationId);
    return;
  }

  if (status === 409 && !message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) {
    sendHttpError(res, 409, { error: message, code: message }, correlationId);
    return;
  }

  if (!isClientSafeErrorToken(message)) {
    logInternalServerError(error, correlationId);
    sendHttpError(res, 500, { error: "internal_error" }, correlationId);
    return;
  }

  sendHttpError(res, status, { error: message, code: message }, correlationId);
}
