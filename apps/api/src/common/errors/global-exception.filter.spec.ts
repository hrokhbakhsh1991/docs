import assert from "node:assert/strict";
import test from "node:test";
import { HttpStatus } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { DataCorruptionError } from "./data-corruption.exception";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { TenantContextMissingError } from "./tenant-context-missing.error";

test("GlobalExceptionFilter returns 500 for TenantContextMissingError", () => {
  let statusCode = 0;
  let payload: unknown;
  let loggedErrorCode: string | undefined;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    }
  };

  const request = {
    path: "/api/v2/tours",
    method: "GET",
    url: "/api/v2/tours",
    headers: {} as Record<string, string | string[] | undefined>
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request
    })
  };

  const logger = {
    error: (_msg: string, meta: Record<string, unknown>) => {
      const code = meta["error_code"];
      if (typeof code === "string") {
        loggedErrorCode = code;
      }
    }
  };
  const requestContext = {
    getRequestId: () => "req-123",
    tryGetRequestId: () => "req-123",
    tryGetCorrelationId: () => "req-123"
  };
  const metrics = {
    recordHttpException: () => undefined
  };

  const filter = new GlobalExceptionFilter(
    logger as never,
    requestContext as never,
    metrics as never
  );

  filter.catch(new TenantContextMissingError(), host as never);

  assert.equal(statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
  assert.equal(loggedErrorCode, "TENANT_CONTEXT_MISSING");
  
  const res = payload as {
    success: boolean;
    requestId: string;
    error: { code: string; details: Record<string, unknown> };
  };
  assert.equal(res.success, false);
  assert.equal(res.requestId, "req-123");
  assert.equal(res.error.code, "TENANT_CONTEXT_MISSING");
  assert.equal(res.error.details.requestId, "req-123");
  assert.ok(res.error.details.timestamp);
});

test("GlobalExceptionFilter maps ValidationPipe errors to details.validationErrors", () => {
  let statusCode = 0;
  let payload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };

  const request = {
    path: "/api/v2/auth/web/session/otp",
    method: "POST",
    url: "/api/v2/auth/web/session/otp",
    headers: {} as Record<string, string | string[] | undefined>,
    requestId: "req-validation",
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };

  const logger = { error: () => undefined };
  const requestContext = {
    tryGetRequestId: () => "req-validation",
    tryGetCorrelationId: () => "req-validation",
  };
  const metrics = { recordHttpException: () => undefined };

  const filter = new GlobalExceptionFilter(
    logger as never,
    requestContext as never,
    metrics as never,
  );

  filter.catch(
    new BadRequestException({
      message: ["phone must be a valid phone number", "otp should not be empty"],
      error: "Bad Request",
    }),
    host as never,
  );

  assert.equal(statusCode, HttpStatus.BAD_REQUEST);
  const res = payload as {
    requestId: string;
    error: {
      code: string;
      details: { validationErrors: Array<{ path: string; code: string; message: string }> };
    };
  };
  assert.equal(res.requestId, "req-validation");
  assert.equal(res.error.code, "VALIDATION_FAILED");
  assert.equal(res.error.details.validationErrors.length, 2);
  assert.equal(res.error.details.validationErrors[0]?.path, "phone");
  assert.equal(res.error.details.validationErrors[1]?.path, "otp");
});

test("GlobalExceptionFilter maps DataCorruptionError to 422 with details.issues", () => {
  let statusCode = 0;
  let payload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };

  const request = {
    path: "/api/v2/settings/tour-wizard-template/instantiate",
    method: "POST",
    url: "/api/v2/settings/tour-wizard-template/instantiate",
    headers: {} as Record<string, string | string[] | undefined>,
    requestId: "req-corrupt",
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };

  const logger = { error: () => undefined };
  const requestContext = {
    tryGetRequestId: () => "req-corrupt",
    tryGetCorrelationId: () => "req-corrupt",
    tryGetTenantId: () => "ws-tenant",
  };
  const metrics = { recordHttpException: () => undefined };

  const filter = new GlobalExceptionFilter(
    logger as never,
    requestContext as never,
    metrics as never,
  );

  filter.catch(
    new DataCorruptionError({
      templateId: "00000000-0000-4000-8000-000000000111",
      workspaceId: "00000000-0000-4000-8000-000000000abc",
      issues: [{ path: "overview.denaliTourKind", message: "Unrecognized key" }],
    }),
    host as never,
  );

  assert.equal(statusCode, HttpStatus.UNPROCESSABLE_ENTITY);
  const res = payload as {
    success: boolean;
    requestId: string;
    error: {
      code: string;
      message: string;
      retryability: string;
      correlationId: string;
      details: {
        templateId: string;
        workspaceId: string;
        issues: Array<{ path: string; message: string }>;
        requestId: string;
        tenantId?: string;
        timestamp?: string;
      };
    };
  };
  assert.equal(res.success, false);
  assert.equal(res.requestId, "req-corrupt");
  assert.equal(res.error.code, "TEMPLATE_CANONICAL_DATA_CORRUPT");
  assert.equal(res.error.message, "Stored workspace tour wizard template canonical_data is invalid");
  assert.equal(res.error.retryability, "NO_RETRY");
  assert.equal(res.error.correlationId, "req-corrupt");
  assert.equal(res.error.details.templateId, "00000000-0000-4000-8000-000000000111");
  assert.equal(res.error.details.workspaceId, "00000000-0000-4000-8000-000000000abc");
  assert.deepEqual(res.error.details.issues, [
    { path: "overview.denaliTourKind", message: "Unrecognized key" },
  ]);
  assert.equal(res.error.details.requestId, "req-corrupt");
  assert.equal(res.error.details.tenantId, "ws-tenant");
  assert.ok(res.error.details.timestamp);
});
