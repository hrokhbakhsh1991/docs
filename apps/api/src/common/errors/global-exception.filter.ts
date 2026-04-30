import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    retryability:
      | "NO_RETRY"
      | "SAFE_RETRY"
      | "RETRY_WITH_BACKOFF"
      | "RETRY_AFTER_ACTION";
    details: Record<string, unknown>;
  };
  requestId: string;
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
  "AUTH_FORBIDDEN_ROLE",
  "TENANT_CONTEXT_INVALID",
  "TENANT_CONTEXT_MISSING",
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
  "INTERNAL_ERROR"
]);

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.resolveRequestId(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const normalized = this.normalizeHttpException(exception, status, requestId);

      this.loggerService.error("request failed", {
        requestId,
        path: request.url,
        method: request.method,
        errorCode: normalized.error.code,
        status
      });

      response.status(status).json(normalized);
      return;
    }

    const fallback = this.normalizeUnknownException(exception, requestId);

    this.loggerService.error("unexpected request failure", {
      requestId,
      path: request.url,
      method: request.method,
      errorCode: fallback.error.code,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      stack: exception instanceof Error ? exception.stack : undefined
    });

    const fallbackStatus =
      fallback.error.code === "TENANT_CONTEXT_INVALID" ||
      fallback.error.code === "TENANT_CONTEXT_MISSING"
        ? HttpStatus.FORBIDDEN
        : HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(fallbackStatus).json(fallback);
  }

  private normalizeUnknownException(
    exception: unknown,
    requestId: string
  ): ErrorEnvelope {
    if (
      exception instanceof Error &&
      (exception.message === "TENANT_CONTEXT_INVALID" ||
        exception.message === "TENANT_CONTEXT_MISSING")
    ) {
      return {
        error: {
          code: exception.message,
          message:
            exception.message === "TENANT_CONTEXT_INVALID"
              ? "Trusted tenant context is invalid"
              : "Trusted tenant context required but absent",
          retryability: "NO_RETRY",
          details: {}
        },
        requestId
      };
    }

    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryability: "RETRY_WITH_BACKOFF",
        details: {}
      },
      requestId
    };
  }

  private resolveRequestId(request: Request): string {
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
    requestId: string
  ): ErrorEnvelope {
    const body = exception.getResponse();

    if (status === HttpStatus.BAD_REQUEST && this.isValidationPipeErrorBody(body)) {
      return {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          retryability: "NO_RETRY",
          details: this.extractValidationDetails(body)
        },
        requestId
      };
    }

    if (this.hasStructuredErrorBody(body)) {
      const code = this.isCanonicalCode(body.error.code)
        ? body.error.code
        : "INTERNAL_ERROR";
      return {
        error: {
          code,
          message: this.isCanonicalCode(body.error.code)
            ? body.error.message
            : this.resolveFallbackMessage(body, exception),
          retryability: this.resolveRetryability(code),
          details: {}
        },
        requestId
      };
    }

    const canonicalFromBody = this.extractCanonicalCodeFromBodyMessage(body);
    const code = canonicalFromBody ?? this.mapStatusToErrorCode(status);
    const fallbackMessage = canonicalFromBody
      ? canonicalFromBody
      : this.resolveFallbackMessage(body, exception);

    return {
      error: {
        code,
        message: fallbackMessage,
        retryability: this.resolveRetryability(code),
        details: {}
      },
      requestId
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

  private resolveRetryability(
    code: string
  ): "NO_RETRY" | "SAFE_RETRY" | "RETRY_WITH_BACKOFF" | "RETRY_AFTER_ACTION" {
    if (
      code === "AUTH_UNAUTHENTICATED" ||
      code === "AUTH_TELEGRAM_CONTEXT_REQUIRED"
    ) {
      return "RETRY_AFTER_ACTION";
    }
    if (code === "CONCURRENCY_CONFLICT" || code === "EXPORT_SNAPSHOT_INCONSISTENT") {
      return "SAFE_RETRY";
    }
    if (
      code === "RATE_LIMITED" ||
      code === "DEPENDENCY_TEMPORARY_UNAVAILABLE" ||
      code === "INTERNAL_ERROR"
    ) {
      return "RETRY_WITH_BACKOFF";
    }
    if (
      code.startsWith("AUTH_") ||
      code.startsWith("TENANT_") ||
      code === "STATE_TRANSITION_INVALID"
    ) {
      return "NO_RETRY";
    }
    return "NO_RETRY";
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

  private extractValidationDetails(
    body: { message: unknown[]; error?: string }
  ): Record<string, unknown> {
    return {
      validationErrors: body.message
    };
  }
}
