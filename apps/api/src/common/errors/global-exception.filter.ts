import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { QueryFailedError } from "typeorm";
import { TenantContextMissingError } from "./tenant-context-missing.error";
import { LoggerService } from "../logger/logger.service";
import type { ObservabilityMetricsService } from "../observability/observability-metrics.service";
import { RequestContextService } from "../request-context/request-context.service";

/** Standard API error JSON (HTTP error responses). */
export type ApiErrorBody = {
  code: string;
  message: string;
  correlationId: string;
  retryability: "NO_RETRY" | "SAFE_RETRY" | "RETRY_WITH_BACKOFF" | "RETRY_AFTER_ACTION";
  details: Record<string, unknown>;
};

type ErrorEnvelope = {
  success: false;
  requestId: string;
  error: ApiErrorBody;
};

type RequestWithRequestId = Request & { requestId?: string };

const RETRYABILITY_VALUES = new Set<ApiErrorBody["retryability"]>([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

import { GlobalErrorTaxonomy } from "@repo/shared";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private static readonly CANONICAL_ERROR_CODES = new Set<string>([
    ...Object.values(GlobalErrorTaxonomy.AUTH),
    ...Object.values(GlobalErrorTaxonomy.TENANT),
    ...Object.values(GlobalErrorTaxonomy.RBAC),
    ...Object.values(GlobalErrorTaxonomy.VALIDATION),
    ...Object.values(GlobalErrorTaxonomy.RESOURCE),
    ...Object.values(GlobalErrorTaxonomy.SYSTEM),
    "VALIDATION_UNKNOWN_FIELD",
    "AUTH_NO_ACTIVE_MEMBERSHIP",
    "AUTH_OTP_INVALID",
    "AUTH_OTP_EXPIRED",
    "AUTH_TOKEN_REVOKED",
    "AUTH_TOKEN_STALE",
    "AUTH_FORBIDDEN_ROLE",
    "AUTH_FORBIDDEN_ABILITY",
    "TENANT_HOST_RESERVED",
    "TENANT_HOST_MISMATCH",
    "TENANT_HOST_TOKEN_MISMATCH",
    "TENANT_SCOPE_CONFLICT",
    "REGISTRATION_DUPLICATE_ACTIVE",
    "REGISTRATION_ROW_VERSION_CONFLICT",
    "CAPACITY_FULL",
    "WAITLIST_CONFLICT_ACTIVE_RECORD",
    "PAYMENT_STATUS_TRANSITION_INVALID",
    "PAYMENT_PENDING_EXISTS",
    "PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN",
    "PAID_TOUR_REQUIRES_AMOUNT",
    "NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT",
    "RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT",
    "INVALID_LIFECYCLE_TRANSITION",
    "TOUR_NOT_PUBLISHABLE",
    "TOUR_NOT_OPEN",
    "TOUR_PATCH_FIELD_FORBIDDEN",
    "EXPORT_SNAPSHOT_INCONSISTENT",
    "PROFILE_ROW_VERSION_CONFLICT",
    "USER_EMAIL_CONFLICT",
    "USER_NATIONAL_ID_CONFLICT",
    "USER_NATIONAL_ID_INVALID",
    "USER_BIRTH_DATE_INVALID",
    "EMAIL_VERIFICATION_INVALID",
    "USER_PHONE_UNCHANGED",
    "USER_PHONE_CONFLICT",
    "MOBILE_OTP_INVALID_PURPOSE",
    "USER_NOT_FOUND",
    "INVITE_NOT_FOUND",
    "INVITE_EMAIL_MISMATCH",
    "INVITE_EXPIRED",
    "WEBHOOK_SIGNATURE_INVALID",
    "WEBHOOK_TIMESTAMP_INVALID",
    "WEBHOOK_TIMESTAMP_EXPIRED",
    "WEBHOOK_IP_NOT_ALLOWED",
    "RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN",
    "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN",
    "RBAC_UNKNOWN_MEMBERSHIP_ROLE",
    "SCHEMA_DRIFT_MISSING_COLUMN",
    "SCHEMA_DRIFT_MISSING_TABLE",
    "OPS_UNAUTHORIZED",
    "DESTINATION_NOT_IN_WORKSPACE"
  ]);

  constructor(
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService,
    private readonly observabilityMetricsService?: ObservabilityMetricsService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { requestId, correlationId } = this.resolveCorrelationBundle(request);

    if (exception instanceof TenantContextMissingError) {
      const envelope = this.buildEnvelope(
        {
          code: "TENANT_CONTEXT_MISSING",
          message: "Tenant context lost during request processing",
          retryability: "NO_RETRY",
          details: {}
        },
        requestId,
        correlationId
      );
      this.observabilityMetricsService?.recordHttpException({
        errorCode: envelope.error.code,
        path: typeof request.path === "string" ? request.path : "",
        method: typeof request.method === "string" ? request.method : "",
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      });
      this.loggerService.error("security anomaly: tenant context lost", {
        status_code: HttpStatus.INTERNAL_SERVER_ERROR,
        route: typeof request.path === "string" ? request.path : request.url,
        error_code: envelope.error.code,
        trace_id: correlationId,
        exception_message: exception.message,
        exception_stack: exception.stack
      });
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(envelope);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const normalized = this.normalizeHttpException(
        exception,
        status,
        requestId,
        correlationId
      );

      this.observabilityMetricsService?.recordHttpException({
        errorCode: normalized.error.code,
        path: typeof request.path === "string" ? request.path : "",
        method: typeof request.method === "string" ? request.method : "",
        statusCode: status
      });

      this.loggerService.error("request failed", {
        status_code: status,
        route: typeof request.path === "string" ? request.path : request.url,
        error_code: normalized.error.code,
        trace_id: correlationId,
        exception_message: exception.message,
        exception_stack: exception.stack
      });

      response.status(status).json(normalized);
      return;
    }

    const fallback = this.normalizeUnknownException(exception, requestId, correlationId);

    this.observabilityMetricsService?.recordHttpException({
      errorCode: fallback.error.code,
      path: typeof request.path === "string" ? request.path : "",
      method: typeof request.method === "string" ? request.method : "",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR
    });

    this.loggerService.error("unexpected request failure", {
      status_code: HttpStatus.INTERNAL_SERVER_ERROR,
      route: typeof request.path === "string" ? request.path : request.url,
      error_code: fallback.error.code,
      trace_id: correlationId,
      exception_name: exception instanceof Error ? exception.name : undefined,
      exception_message: exception instanceof Error ? exception.message : String(exception),
      exception_stack: exception instanceof Error ? exception.stack : undefined
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fallback);
  }

  private buildEnvelope(
    partial: Pick<ApiErrorBody, "code" | "message"> &
      Partial<Pick<ApiErrorBody, "retryability" | "details">>,
    requestId: string,
    correlationId: string
  ): ErrorEnvelope {
    const retryability = this.normalizeRetryability(partial.retryability);
    const baseDetails =
      partial.details && typeof partial.details === "object" && !Array.isArray(partial.details)
        ? (partial.details as Record<string, unknown>)
        : {};
    let tenantId: string | undefined;
    try {
      tenantId = this.requestContextService.tryGetTenantId();
    } catch {
      tenantId = undefined;
    }
    const details: Record<string, unknown> = {
      ...baseDetails,
      requestId,
      ...(tenantId ? { tenantId } : {}),
      timestamp: new Date().toISOString(),
    };
    return {
      success: false,
      requestId,
      error: {
        code: partial.code,
        message: partial.message,
        correlationId,
        retryability,
        details
      }
    };
  }

  private normalizeRetryability(
    value: ApiErrorBody["retryability"] | undefined
  ): ApiErrorBody["retryability"] {
    if (value && RETRYABILITY_VALUES.has(value)) {
      return value;
    }
    return "NO_RETRY";
  }

  private normalizeUnknownException(
    exception: unknown,
    requestId: string,
    correlationId: string
  ): ErrorEnvelope {
    if (exception instanceof QueryFailedError || this.isTypeOrmQueryFailedError(exception)) {
      const schemaDriftCode = this.resolveSchemaDriftErrorCode(exception);
      return this.buildEnvelope(
        {
          code: schemaDriftCode,
          message: "Database schema is out of sync with application expectations",
          retryability: "NO_RETRY",
          details: {}
        },
        requestId,
        correlationId
      );
    }

    if (
      exception instanceof Error &&
      (exception.message === "TENANT_CONTEXT_INVALID" ||
        exception.message === "TENANT_CONTEXT_MISSING")
    ) {
      return this.buildEnvelope(
        {
          code: exception.message,
          message:
            exception.message === "TENANT_CONTEXT_INVALID"
              ? "Trusted tenant context is invalid"
              : "Trusted tenant context required but absent",
          retryability: "NO_RETRY",
          details: {}
        },
        requestId,
        correlationId
      );
    }

    return this.buildEnvelope(
      {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryability: "NO_RETRY",
        details: {}
      },
      requestId,
      correlationId
    );
  }

  private isTypeOrmQueryFailedError(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") {
      return false;
    }
    const withName = exception as { name?: unknown };
    return withName.name === "QueryFailedError";
  }

  private resolveSchemaDriftErrorCode(exception: unknown): string {
    const message = exception instanceof Error ? exception.message.toLowerCase() : String(exception).toLowerCase();
    if (message.includes("column") && message.includes("does not exist")) {
      return "SCHEMA_DRIFT_MISSING_COLUMN";
    }
    if (message.includes("relation") && message.includes("does not exist")) {
      return "SCHEMA_DRIFT_MISSING_TABLE";
    }
    return "SCHEMA_DRIFT_QUERY_FAILED";
  }

  private resolveCorrelationBundle(request: Request): { requestId: string; correlationId: string } {
    const headers = request.headers ?? {};
    const headerRequestIdRaw = headers["x-request-id"];
    const headerRequestId =
      typeof headerRequestIdRaw === "string" && headerRequestIdRaw.trim() !== ""
        ? headerRequestIdRaw.trim()
        : Array.isArray(headerRequestIdRaw) &&
            typeof headerRequestIdRaw[0] === "string" &&
            headerRequestIdRaw[0].trim() !== ""
          ? headerRequestIdRaw[0].trim()
          : undefined;

    const headerCorrRaw = headers["x-correlation-id"];
    const headerCorrelationId =
      typeof headerCorrRaw === "string" && headerCorrRaw.trim() !== ""
        ? headerCorrRaw.trim()
        : Array.isArray(headerCorrRaw) &&
            typeof headerCorrRaw[0] === "string" &&
            headerCorrRaw[0].trim() !== ""
          ? headerCorrRaw[0].trim()
          : undefined;

    const fromRequestAug = (request as RequestWithRequestId).requestId;
    const fromRequestAugId =
      typeof fromRequestAug === "string" && fromRequestAug.trim() !== "" ? fromRequestAug.trim() : undefined;

    let ctxRequestId: string | undefined;
    let ctxCorrelationId: string | undefined;
    try {
      ctxRequestId = this.requestContextService.tryGetRequestId();
    } catch {
      ctxRequestId = undefined;
    }
    try {
      ctxCorrelationId = this.requestContextService.tryGetCorrelationId();
    } catch {
      ctxCorrelationId = undefined;
    }

    const requestId =
      ctxRequestId?.trim() ||
      headerRequestId ||
      fromRequestAugId ||
      randomUUID();

    const correlationId =
      ctxCorrelationId?.trim() || headerCorrelationId || requestId;

    return { requestId, correlationId };
  }

  private normalizeHttpException(
    exception: HttpException,
    status: number,
    requestId: string,
    correlationId: string
  ): ErrorEnvelope {
    const body = exception.getResponse();

    if (status === HttpStatus.BAD_REQUEST && this.isValidationPipeErrorBody(body)) {
      return this.buildEnvelope(
        {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          retryability: "NO_RETRY",
          details: {}
        },
        requestId,
        correlationId
      );
    }

    if (this.hasStructuredErrorBody(body)) {
      const raw = body.error;
      const code =
        typeof raw.code === "string" && raw.code.trim() !== ""
          ? this.isCanonicalCode(raw.code)
            ? raw.code
            : raw.code.trim()
          : "INTERNAL_ERROR";
      const message =
        typeof raw.message === "string" && raw.message.trim() !== ""
          ? raw.message.trim()
          : this.resolveFallbackMessage(body, exception);
      const retryability = this.normalizeRetryability(
        typeof raw.retryability === "string" ? (raw.retryability as ApiErrorBody["retryability"]) : undefined
      );
      const details = this.coerceDetails(raw.details);
      return this.buildEnvelope({ code, message, retryability, details }, requestId, correlationId);
    }

    const canonicalFromBody = this.extractCanonicalCodeFromBodyMessage(body);
    const code = canonicalFromBody ?? this.mapStatusToErrorCode(status);
    const fallbackMessage = canonicalFromBody
      ? canonicalFromBody
      : this.resolveFallbackMessage(body, exception);

    return this.buildEnvelope(
      {
        code,
        message: fallbackMessage,
        retryability: this.defaultRetryabilityForHttpStatus(status),
        details: {}
      },
      requestId,
      correlationId
    );
  }

  private defaultRetryabilityForHttpStatus(status: number): ApiErrorBody["retryability"] {
    if (status === HttpStatus.TOO_MANY_REQUESTS || status === HttpStatus.SERVICE_UNAVAILABLE) {
      return "RETRY_WITH_BACKOFF";
    }
    return "NO_RETRY";
  }

  private coerceDetails(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private mapStatusToErrorCode(status: number): string {
    if (status >= 500) {
      return "INTERNAL_ERROR";
    }
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return "AUTH_UNAUTHENTICATED";
      case HttpStatus.FORBIDDEN:
        return "AUTH_FORBIDDEN_ROLE";
      case HttpStatus.NOT_FOUND:
        return "RESOURCE_NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "STATE_TRANSITION_INVALID";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMITED";
      default:
        return "INTERNAL_ERROR";
    }
  }

  private resolveFallbackMessage(body: unknown, exception: HttpException): string {
    if (typeof body === "string" && body.trim() !== "") {
      return body;
    }
    if (body && typeof body === "object") {
      const candidate = body as { message?: unknown };
      if (typeof candidate.message === "string" && candidate.message.trim() !== "") {
        return candidate.message;
      }
    }
    return exception.message || "Request failed";
  }

  private extractCanonicalCodeFromBodyMessage(body: unknown): string | null {
    if (!body || typeof body !== "object") {
      return null;
    }
    const candidate = body as { message?: unknown };
    if (typeof candidate.message !== "string") {
      return null;
    }
    return this.isCanonicalCode(candidate.message) ? candidate.message : null;
  }

  private isCanonicalCode(value: string): boolean {
    return (
      GlobalExceptionFilter.CANONICAL_ERROR_CODES.has(value) || value.startsWith("WORKSPACE_RULE_")
    );
  }

  private hasStructuredErrorBody(
    body: unknown
  ): body is {
    error: {
      code: string;
      message: string;
      retryability?: unknown;
      details?: unknown;
    };
  } {
    if (!body || typeof body !== "object") {
      return false;
    }

    const candidate = body as {
      error?: { code?: unknown; message?: unknown };
    };

    return (
      typeof candidate.error?.code === "string" &&
      typeof candidate.error?.message === "string"
    );
  }

  private isValidationPipeErrorBody(
    body: unknown
  ): body is { message: unknown[]; error?: string } {
    if (!body || typeof body !== "object") {
      return false;
    }
    const candidate = body as { message?: unknown; error?: unknown };
    return (
      Array.isArray(candidate.message) &&
      candidate.message.length > 0 &&
      (candidate.error === undefined || typeof candidate.error === "string")
    );
  }
}
