import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { runWithHttpRequestContext } from "./bind-request-context";
import {
  getActiveTraceId,
  requireActiveTraceId,
  runWithTraceContext,
} from "../observability/trace-request-context";
import { integrationTenantId } from "../../test/test-helpers";

function fakeAuth(tenantId: string): TenantAuthContext {
  return {
    tenantId,
    userId: "trace-bind-user",
    workspaceId: "ws-trace-bind",
    role: "admin",
    status: "ACTIVE",
  };
}

describe("runWithHttpRequestContext trace bind (TRACE-REGEN-01 / DEC-044)", () => {
  it("reuses outer trace ALS instead of resolving headers again", async () => {
    const outerTrace = randomUUID();
    const innerTraceIds: string[] = [];

    await runWithTraceContext(outerTrace, async () => {
      const req = { headers: {} } as IncomingMessage;
      await runWithHttpRequestContext(req, fakeAuth(integrationTenantId()), async () => {
        innerTraceIds.push(requireActiveTraceId());
      });
      assert.equal(getActiveTraceId(), outerTrace, "outer trace must survive inner bind");
    });

    assert.equal(innerTraceIds.length, 1);
    assert.equal(innerTraceIds[0], outerTrace);
  });

  it("resolves trace from headers when no outer ALS is bound", async () => {
    const headerTrace = randomUUID();
    const req = {
      headers: { "x-correlation-id": headerTrace },
    } as IncomingMessage;

    await runWithHttpRequestContext(req, fakeAuth(integrationTenantId()), async () => {
      assert.equal(requireActiveTraceId(), headerTrace);
    });

    assert.equal(getActiveTraceId(), undefined, "trace ALS must clear after bind settles");
  });
});
