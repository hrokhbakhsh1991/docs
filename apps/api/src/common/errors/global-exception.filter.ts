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

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    traceId: string;
  };
};
type RequestWithRequestId = Request & { requestId?: string };

const CANONICAL_ERROR_CODES = new Set<string>([
  "VALIDATION_FAILED",
  "VALIDATION_REQUIRED_FIELD_MISSING",
  "VALIDATION_ENUM_INVALID",
  "VALIDATION_FIELD_FORMAT_INVALID",
  "VALIDATION_UNKNOWN_FIELD",
  "AUTH_TELEGRAM_CONTEXT_REQUIRED",
  "AUTH_UNAUTHENTICATED",
  "AUTH_PHONE_INVALID",
  "AUTH_NO_ACTIVE_MEMBERSHIP",
  "AUTH_OTP_INVALID",
  "AUTH_OTP_EXPIRED",
  "AUTH_TOKEN_REVOKED",
  "AUTH_FORBIDDEN_ROLE",
  "TENANT_CONTEXT_INVALID",
  "TENANT_CONTEXT_MISSING",
  "TENANT_HOST_UNKNOWN",
  "TENANT_HOST_INVALID",
  "TENANT_HOST_RESERVED",
  "TENANT_HOST_MISMATCH",
  "TENANT_HOST_TOKEN_MISMATCH",
  "TENANT_SCOPE_CONFLICT",
  "TENANT_SCOPE_FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "REGISTRATION_DUPLICATE_ACTIVE",
  "CAPACITY_FULL",
  "WAITLIST_CONFLICT_ACTIVE_RECORD",
  "PAYMENT_STATUS_TRANSITION_INVALID",
  "STATE_TRANSITION_INVALID",
  "CONCURRENCY_CONFLICT",
  "IDEMPOTENCY_KEY_REPLAY_MISMATCH",
  "EXPORT_SNAPSHOT_INCONSISTENT",
  "RATE_LIMITED",
  "DEPENDENCY_TEMPORARY_UNAVAILABLE",
  "INTERNAL_ERROR",
  "INVITE_NOT_FOUND",
  "INVITE_EMAIL_MISMATCH",
  "INVITE_EXPIRED",
  "WEBHOOK_SIGNATURE_INVALID",
  "WEBHOOK_TIMESTAMP_INVALID",
  "WEBHOOK_TIMESTAMP_EXPIRED",
  "WEBHOOK_IP_NOT_ALLOWED",
  "RBAC_SELF_ROLE_CHANGE_FORBIDDEN",
  "RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN",
  "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN",
  "RBAC_INSUFFICIENT_ROLE_PRIVILEGE",
  "RBAC_UNKNOWN_MEMBERSHIP_ROLE",
  "SCHEMA_DRIFT_MISSING_COLUMN",
  "SCHEMA_DRIFT_MISSING_TABLE",
  "SCHEMA_DRIFT_QUERY_FAILED"
]);

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService,
    private readonly observabilityMetricsService?: ObservabilityMetricsService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = this.resolveTraceId(request);

    if (exception instanceof TenantContextMissingError) {
      const envelope: ErrorEnvelope = {
        success: false,
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Tenant context lost during request processing",
          traceId
        }
      };
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
        trace_id: traceId,
        exception_message: exception.message,
        exception_stack: exception.stack
      });
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(envelope);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const normalized = this.normalizeHttpException(exception, status, traceId);

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
        trace_id: traceId,
        exception_message: exception.message,
        exception_stack: exception.stack
      });

      response.status(status).json(normalized);
      return;
    }

    const fallback = this.normalizeUnknownException(exception, traceId);

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
      trace_id: traceId,
      exception_name: exception instanceof Error ? exception.name : undefined,
      exception_message: exception instanceof Error ? exception.message : String(exception),
      exception_stack: exception instanceof Error ? exception.stack : undefined
    });

    const fallbackStatus =
      fallback.error.code === "TENANT_CONTEXT_INVALID" ||
      fallback.error.code === "TENANT_CONTEXT_MISSING"
        ? HttpStatus.INTERNAL_SERVER_ERROR
        : HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(fallbackStatus).json(fallback);
  }

  private normalizeUnknownException(
    exception: unknown,
    traceId: string
  ): ErrorEnvelope {
    if (exception instanceof QueryFailedError || this.isTypeOrmQueryFailedError(exception)) {
      const schemaDriftCode = this.resolveSchemaDriftErrorCode(exception);
      return {
        success: false,
        error: {
          code: schemaDriftCode,
          message: "Database schema is out of sync with application expectations",
          traceId
        }
      };
    }

    if (
      exception instanceof Error &&
      (exception.message === "TENANT_CONTEXT_INVALID" ||
        exception.message === "TENANT_CONTEXT_MISSING")
    ) {
      return {
        success: false,
        error: {
          code: exception.message,
          message:
            exception.message === "TENANT_CONTEXT_INVALID"
              ? "Trusted tenant context is invalid"
              : "Trusted tenant context required but absent",
          traceId
        }
      };
    }

    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        traceId
      }
    };
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

  private resolveTraceId(request: Request): string {
    const headerValue = request.headers["x-request-id"];
    if (typeof headerValue === "string" && headerValue.trim() !== "") {
      return headerValue.trim();
    }
    if (Array.isArray(headerValue) && typeof headerValue[0] === "string" && headerValue[0].trim() !== "") {
      return headerValue[0].trim();
    }
    try {
      return this.requestContextService.getRequestId();
    } catch {
      const fromRequest = (request as RequestWithRequestId).requestId;
      if (typeof fromRequest === "string" && fromRequest.trim() !== "") {
        return fromRequest;
      }
      return randomUUID();
    }
  }

  private normalizeHttpException(
    exception: HttpException,
    status: number,
    traceId: string
  ): ErrorEnvelope {
    const body = exception.getResponse();

    if (status === HttpStatus.BAD_REQUEST && this.isValidationPipeErrorBody(body)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          traceId
        }
      };
    }

    if (this.hasStructuredErrorBody(body)) {
      const code = this.isCanonicalCode(body.error.code)
        ? body.error.code
        : "INTERNAL_ERROR";
      return {
        success: false,
        error: {
          code,
          message: this.isCanonicalCode(body.error.code)
            ? body.error.message
            : this.resolveFallbackMessage(body, exception),
          traceId
        }
      };
    }

    const canonicalFromBody = this.extractCanonicalCodeFromBodyMessage(body);
    const code = canonicalFromBody ?? this.mapStatusToErrorCode(status);
    const fallbackMessage = canonicalFromBody
      ? canonicalFromBody
      : this.resolveFallbackMessage(body, exception);

    return {
      success: false,
      error: {
        code,
        message: fallbackMessage,
        traceId
      }
    };
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
    return CANONICAL_ERROR_CODES.has(value);
  }

  private hasStructuredErrorBody(
    body: unknown
  ): body is { error: { code: string; message: string } } {
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
