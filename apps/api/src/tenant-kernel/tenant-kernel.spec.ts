import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { IncomingMessage } from "node:http";

import {
  UNAUTHORIZED_DEV_BEARER_DISABLED,
  UNAUTHORIZED_MISSING_WORKSPACE_ID,
} from "./auth-errors";
import { encodeDevBearerToken } from "./parse-bearer";
import { resolveTenantContextFromRequest } from "./tenant-kernel";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
});

function mockRequest(headers: Record<string, string>): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe("TenantKernel.resolveTenantContextFromRequest", () => {
  it("rejects missing x-workspace-id with 401 code", async () => {
    await assert.rejects(
      () =>
        resolveTenantContextFromRequest(
          mockRequest({
            "x-authenticated-tenant-id": "tenant-a",
            "x-user-id": "u1",
            "x-actor-role": "member",
            "x-membership-status": "ACTIVE",
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_MISSING_WORKSPACE_ID);
        return true;
      },
    );
  });

  it("rejects dev Bearer when AUTH_ALLOW_DEV_BEARER is not true", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_ALLOW_DEV_BEARER;
    const authorization = encodeDevBearerToken({
      userId: "u1",
      tenantId: "tenant-a",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    await assert.rejects(
      () => resolveTenantContextFromRequest(mockRequest({ authorization })),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_DEV_BEARER_DISABLED);
        return true;
      },
    );
  });

  it("resolves from dev Bearer token without headers when dev bearer allowed in test env", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    const authorization = encodeDevBearerToken({
      userId: "jwt-u",
      tenantId: "tenant-jwt",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-jwt",
    });
    const ctx = await resolveTenantContextFromRequest(mockRequest({ authorization }));
    assert.equal(ctx.tenantId, "tenant-jwt");
    assert.equal(ctx.workspaceId, "ws-jwt");
  });
});
