import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";

import { createRequestListener } from "../src/app";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import {
  UNAUTHORIZED_DEV_BEARER_DISABLED,
  UNAUTHORIZED_MISSING_WORKSPACE_ID,
} from "../src/tenant-kernel/auth-errors";
import { createTestToursService, integrationTenantId } from "./test-helpers";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
};

let jwtPublicKeyPem = "";
let jwtPrivateKey: CryptoKey;

before(async () => {
  process.env.STORAGE_DRIVER = "memory";
  const pair = await generateKeyPair("RS256");
  jwtPrivateKey = pair.privateKey;
  jwtPublicKeyPem = await exportSPKI(pair.publicKey);
});

async function signProductionJwt(
  tenantId: string,
  claims: Record<string, string> = {}
): Promise<string> {
  return new SignJWT({
    tenant_id: tenantId,
    role: "admin",
    membership_status: "ACTIVE",
    workspace_id: "ws-prod-jwt",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.sub ?? "prod-jwt-user")
    .setIssuer("tour-ops")
    .setAudience("tour-ops-api")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(jwtPrivateKey);
}

beforeEach(() => {
  process.env.STORAGE_DRIVER = "memory";
});

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
  process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
  process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
  process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
  process.env.STORAGE_DRIVER = "memory";
});

type JsonResponse = {
  readonly status: number;
  readonly body: unknown;
};

function fullMemberHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "user-1",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

function memberHeadersWithoutWorkspace(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "user-1",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  }
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: options.path,
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            ...(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
            ...options.headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe("tenant-security (TenantKernel ingress)", () => {
  let listener: ReturnType<typeof createRequestListener>;
  const tenantA = integrationTenantId();
  const tenantJwt = integrationTenantId();

  before(() => {
    listener = createRequestListener({
      toursService: createTestToursService(),
    });
  });

  it("POST without x-workspace-id returns 401 UNAUTHORIZED_MISSING_WORKSPACE_ID", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeadersWithoutWorkspace(tenantA),
      body: { data: { basics: { title: "No workspace" }, details: { summary: "" } } },
    });

    assert.equal(res.status, 401);
    assert.equal((res.body as { error?: string }).error, UNAUTHORIZED_MISSING_WORKSPACE_ID);
  });

  it("GET without x-workspace-id returns 401 UNAUTHORIZED_MISSING_WORKSPACE_ID", async () => {
    const created = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: fullMemberHeaders(tenantA),
      body: { data: { basics: { title: "Seed" }, details: { summary: "" } } },
    });
    assert.equal(created.status, 201);
    const tourId = (created.body as { id: string }).id;

    const res = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}`,
      headers: memberHeadersWithoutWorkspace(tenantA),
    });

    assert.equal(res.status, 401);
    assert.equal((res.body as { error?: string }).error, UNAUTHORIZED_MISSING_WORKSPACE_ID);
  });

  it("POST with dev Bearer returns 401 when AUTH_ALLOW_DEV_BEARER is disabled", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_ALLOW_DEV_BEARER;
    const authorization = encodeDevBearerToken({
      userId: "attacker",
      tenantId: "tenant-evil",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });

    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: { Authorization: authorization },
      body: { data: { basics: { title: "Evil" }, details: { summary: "" } } },
    });

    assert.equal(res.status, 401);
    assert.equal((res.body as { error?: string }).error, UNAUTHORIZED_DEV_BEARER_DISABLED);
  });

  it("POST with dev Bearer (no headers) succeeds when dev bearer allowed in test env", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    const authorization = encodeDevBearerToken({
      userId: "jwt-user",
      tenantId: tenantJwt,
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-jwt",
    });

    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: { Authorization: authorization },
      body: { data: { basics: { title: "JWT tour" }, details: { summary: "" } } },
    });

    assert.equal(res.status, 201);
    assert.equal((res.body as { tenantId: string }).tenantId, tenantJwt);
  });

  it("JWT with conflicting tenant_id and tenantId claims returns 401 (F-11)", async () => {
    process.env.AUTH_JWT_PUBLIC_KEY = jwtPublicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";

    const token = await new SignJWT({
      tenant_id: tenantJwt,
      tenantId: integrationTenantId(),
      role: "admin",
      membership_status: "ACTIVE",
      workspace_id: "ws-alias",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("alias-user")
      .setIssuer("tour-ops")
      .setAudience("tour-ops-api")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(jwtPrivateKey);

    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: { Authorization: `Bearer ${token}` },
      body: { data: { basics: { title: "Alias conflict" }, details: { summary: "" } } },
    });

    assert.equal(res.status, 401);
    assert.equal((res.body as { error?: string }).error, "UNAUTHORIZED_INVALID_BEARER_TOKEN");
  });

  it("POST with RS256 JWT in production mode returns 201 (F-17)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_ALLOW_DEV_BEARER;
    process.env.AUTH_JWT_PUBLIC_KEY = jwtPublicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    process.env.STORAGE_DRIVER = "memory";
    const productionTenantId = "00000000-0000-4000-8000-000000000001";
    const authorization = `Bearer ${await signProductionJwt(productionTenantId)}`;

    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: { Authorization: authorization },
      body: { data: { basics: { title: "Prod JWT tour" }, details: { summary: "" } } },
    });

    assert.equal(res.status, 201);
    assert.equal((res.body as { tenantId: string }).tenantId, productionTenantId);
  });

  it("POST without auth headers or Bearer returns 401", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: {},
      body: { data: { basics: { title: "Anonymous" }, details: { summary: "" } } },
    });

    assert.equal(res.status, 401);
    assert.match((res.body as { error?: string }).error ?? "", /^UNAUTHORIZED_/);
  });
});
