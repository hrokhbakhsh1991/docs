import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { WorkspaceNotCertifiedForProductionError } from "../src/internal/provisioning.errors.ts";
import { handleHttpError } from "../src/middleware/error-interceptor.ts";
import { runWithTraceContext } from "../src/observability/trace-request-context.ts";

function createMockResponse(): ServerResponse & {
  statusCode: number;
  body: string;
} {
  return {
    statusCode: 0,
    body: "",
    writableEnded: false,
    setHeader() {},
    end(payload?: string) {
      if (payload !== undefined) {
        this.body = payload;
      }
      this.writableEnded = true;
    },
  } as unknown as ServerResponse & {
    statusCode: number;
    body: string;
  };
}

describe("WorkspaceNotCertifiedForProductionError (Phase H2)", () => {
  it("maps to 422 via handleHttpError", () => {
    const res = createMockResponse();
    void runWithTraceContext("trace-cert-error", () => {
      handleHttpError(res, new WorkspaceNotCertifiedForProductionError("urban", "urban"));
    });
    assert.equal(res.statusCode, 422);
    const payload = JSON.parse(res.body) as {
      code?: string;
      workspaceType?: string;
    };
    assert.equal(payload.code, "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION");
    assert.equal(payload.workspaceType, "urban");
  });
});
