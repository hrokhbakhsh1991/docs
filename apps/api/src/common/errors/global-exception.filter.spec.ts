import assert from "node:assert/strict";
import test from "node:test";
import { HttpStatus } from "@nestjs/common";
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
    url: "/api/v2/tours"
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
    getRequestId: () => "req-123"
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
  assert.deepEqual(payload, {
    error: {
      code: "TENANT_CONTEXT_MISSING",
      message: "Tenant context lost during request processing",
      retryability: "NO_RETRY",
      details: {}
    },
    requestId: "req-123"
  });
});
