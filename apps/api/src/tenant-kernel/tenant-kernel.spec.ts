import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

import { IncomingMessage } from "node:http";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";

import {
  UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION,
  UNAUTHORIZED_DEV_BEARER_DISABLED,
  UNAUTHORIZED_MISSING_WORKSPACE_ID,
} from "./auth-errors";
import { encodeDevBearerToken } from "./parse-bearer";
import { resolveTenantContextFromRequest } from "./tenant-kernel";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
};

let jwtPublicKeyPem = "";
let jwtPrivateKey: CryptoKey;

before(async () => {
  const pair = await generateKeyPair("RS256");
  jwtPrivateKey = pair.privateKey;
  jwtPublicKeyPem = await exportSPKI(pair.publicKey);
});

async function signTestJwt(claims: Record<string, string>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.sub ?? "user-jwt")
    .setIssuer("tour-ops")
    .setAudience("tour-ops-api")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(jwtPrivateKey);
}

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
  process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
  process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
  process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
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
          })
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_MISSING_WORKSPACE_ID);
        return true;
      }
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
      }
    );
  });

  it("rejects header-only auth in production (JWT-only ingress)", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----";
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    await assert.rejects(
      () =>
        resolveTenantContextFromRequest(
          mockRequest({
            "x-authenticated-tenant-id": "tenant-a",
            "x-user-id": "u1",
            "x-actor-role": "member",
            "x-membership-status": "ACTIVE",
            "x-workspace-id": "ws-1",
          })
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION);
        return true;
      }
    );
  });

  it("rejects JWT member role without workspace_id (F-10)", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_JWT_PUBLIC_KEY = jwtPublicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    const token = await signTestJwt({
      sub: "member-user",
      tenant_id: "tenant-a",
      role: "member",
      membership_status: "ACTIVE",
    });
    await assert.rejects(
      () => resolveTenantContextFromRequest(mockRequest({ authorization: `Bearer ${token}` })),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_MISSING_WORKSPACE_ID);
        return true;
      }
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
