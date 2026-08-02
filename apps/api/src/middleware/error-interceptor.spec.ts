import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { handleHttpError, resolveCorrelationId } from "./error-interceptor";
import { runWithTraceContext } from "../observability/trace-request-context";
import { WORKSPACE_TYPE_UNRESOLVED } from "../tenant/resolve-workspace-type";
import { FINANCE_WORKSPACE_UNSUPPORTED } from "../workspace-finance/resolve-finance-workspace-type-for-tenant";

describe("resolveCorrelationId (TRACE-REGEN-02 / DEC-126)", () => {
  it("requires trace ALS — no randomUUID fallback", () => {
    assert.throws(() => resolveCorrelationId(), /TRACE_CONTEXT_NOT_BOUND/);
  });

  it("returns active trace id when ALS is bound", () => {
    void runWithTraceContext("ingress-trace-abc", () => {
      assert.equal(resolveCorrelationId(), "ingress-trace-abc");
    });
  });
});

describe("handleHttpError — WORKSPACE_TYPE_UNRESOLVED (TODO-011)", () => {
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
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps WORKSPACE_TYPE_UNRESOLVED:<uuid> to 404 with stable code (not INTERNAL_ERROR)", () => {
    const res = createMockResponse();
    const tenantId = "00000000-0000-4000-8000-00000000dead";
    void runWithTraceContext("ws-unresolved-trace", () => {
      handleHttpError(res, new Error(`${WORKSPACE_TYPE_UNRESOLVED}:${tenantId}`));
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, WORKSPACE_TYPE_UNRESOLVED);
    assert.equal(body.code, WORKSPACE_TYPE_UNRESOLVED);
    assert.equal(res.body.includes(tenantId), false);
  });
});

describe("handleHttpError — FINANCE_WORKSPACE_UNSUPPORTED (urban fail-closed)", () => {
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
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps FINANCE_WORKSPACE_UNSUPPORTED: workspaceType=urban to 404 stable code (not 500)", () => {
    const res = createMockResponse();
    void runWithTraceContext("finance-unsupported-trace", () => {
      handleHttpError(
        res,
        new Error(`${FINANCE_WORKSPACE_UNSUPPORTED}: workspaceType=urban`)
      );
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, FINANCE_WORKSPACE_UNSUPPORTED);
    assert.equal(body.code, FINANCE_WORKSPACE_UNSUPPORTED);
    assert.equal(res.body.includes("workspaceType"), false);
  });
});
