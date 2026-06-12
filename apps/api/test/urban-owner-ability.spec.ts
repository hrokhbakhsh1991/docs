/**
 * Phase 8.1 — API owner ability + ASM-8.1-003..010, 013..014, 018..020, 021..024
 * Authority: docs/phase-8/appendices/AGENT-STATE-MAP-8.1.yaml
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { buildTenantAuthz } from "@app-tour/workspace-sdk";

import { createRequestListener } from "../src/app";
import { UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION } from "../src/tenant-kernel/auth-errors";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import {
  assertWorkspaceOwner,
  URBAN_OWNER_REQUIRED,
  UrbanOwnerRequiredError,
} from "@app-tour/workspace-urban/http";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

import { canLoadUrbanSettings } from "../../../docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const URBAN_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";
const URBAN_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000402";
const URBAN_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000405";

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
  };
}

function urbanBearer(role: "owner" | "admin" | "member", tenantId = URBAN_TENANT_ID): string {
  const userId =
    role === "owner"
      ? URBAN_OWNER_USER_ID
      : role === "admin"
        ? URBAN_ADMIN_USER_ID
        : URBAN_MEMBER_USER_ID;
  return encodeDevBearerToken({
    userId,
    tenantId,
    role,
    status: "ACTIVE",
    workspaceId: URBAN_WORKSPACE_ID,
  });
}

type JsonResponse = { status: number; body: unknown };

async function requestUrban(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "PATCH",
  authorization?: string,
  body?: unknown
): Promise<JsonResponse> {
  const http = await import("node:http");
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/urban/settings",
          method,
          headers: {
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
            ...(authorization ? { Authorization: authorization } : {}),
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

installMemoryStorageDriverForDescribe();

describe("Phase 8.1 — urban-owner-ability (API-8.1 middleware)", () => {
  it("API-8.1-01 member assertWorkspaceOwner urban.settings.update throws UrbanOwnerRequiredError", () => {
    const auth = {
      userId: URBAN_MEMBER_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "member" as const,
      status: "ACTIVE" as const,
      workspaceId: URBAN_WORKSPACE_ID,
    };
    assert.throws(
      () =>
        assertWorkspaceOwner({
          auth,
          workspaceType: "urban",
          surface: "urban.settings.update",
        }),
      UrbanOwnerRequiredError
    );
  });

  it("API-8.1-02 admin assertWorkspaceOwner urban.settings.update throws UrbanOwnerRequiredError", () => {
    const auth = {
      userId: URBAN_ADMIN_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "admin" as const,
      status: "ACTIVE" as const,
      workspaceId: URBAN_WORKSPACE_ID,
    };
    assert.throws(
      () =>
        assertWorkspaceOwner({
          auth,
          workspaceType: "urban",
          surface: "urban.settings.update",
        }),
      UrbanOwnerRequiredError
    );
  });

  it("API-8.1-03 owner assertWorkspaceOwner urban.settings.update does not throw", () => {
    const auth = {
      userId: URBAN_OWNER_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "owner" as const,
      status: "ACTIVE" as const,
      workspaceId: URBAN_WORKSPACE_ID,
    };
    assert.doesNotThrow(() =>
      assertWorkspaceOwner({
        auth,
        workspaceType: "urban",
        surface: "urban.settings.update",
      })
    );
  });
});

describe("Phase 8.1 — ASM HTTP owner denial + auth (003..010, 013..014, 018..020)", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    listener = createRequestListener({ toursService: createTestToursService() });
  });

  it("ASM-8.1-003 GET /urban/settings admin privilege escalation returns 403 URBAN_OWNER_REQUIRED", async () => {
    const response = await requestUrban(listener, "GET", urbanBearer("admin"));
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });

  it("ASM-8.1-004 PATCH /urban/settings admin privilege escalation returns 403 URBAN_OWNER_REQUIRED", async () => {
    const response = await requestUrban(listener, "PATCH", urbanBearer("admin"), {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open" },
      },
    });
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });

  it("ASM-8.1-005 GET /urban/settings member returns 403 URBAN_OWNER_REQUIRED", async () => {
    const response = await requestUrban(listener, "GET", urbanBearer("member"));
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });

  it("ASM-8.1-006 PATCH /urban/settings member returns 403 URBAN_OWNER_REQUIRED", async () => {
    const response = await requestUrban(listener, "PATCH", urbanBearer("member"), {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open" },
      },
    });
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });

  it("ASM-8.1-007 GET /urban/settings invalid bearer returns 401 UNAUTHORIZED_INVALID_BEARER_TOKEN", async () => {
    const response = await requestUrban(listener, "GET", "Bearer dev.invalid-token");
    expect(response.status).toBe(401);
    expect((response.body as { error?: string }).error).toBe("UNAUTHORIZED_INVALID_BEARER_TOKEN");
  });

  it("ASM-8.1-008 PATCH /urban/settings invalid bearer returns 401 UNAUTHORIZED_INVALID_BEARER_TOKEN", async () => {
    const response = await requestUrban(listener, "PATCH", "Bearer dev.invalid-token", {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open" },
      },
    });
    expect(response.status).toBe(401);
    expect((response.body as { error?: string }).error).toBe("UNAUTHORIZED_INVALID_BEARER_TOKEN");
  });

  it("ASM-8.1-009 GET /urban/settings anonymous returns 401 UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION", async () => {
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const response = await requestUrban(listener, "GET");
    process.env.NODE_ENV = prior;
    expect(response.status).toBe(401);
    expect((response.body as { error?: string }).error).toBe(
      UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION
    );
  });

  it("ASM-8.1-010 PATCH /urban/settings anonymous returns 401 UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION", async () => {
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const response = await requestUrban(listener, "PATCH", undefined, {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open" },
      },
    });
    process.env.NODE_ENV = prior;
    expect(response.status).toBe(401);
    expect((response.body as { error?: string }).error).toBe(
      UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION
    );
  });

  it("ASM-8.1-013 GET /urban/settings malformed authz context maps to 403 URBAN_OWNER_REQUIRED", async () => {
    process.env.URBAN_TEST_INJECT_AUTHZ_BUILD_THROW = "1";
    const response = await requestUrban(listener, "GET", urbanBearer("owner"));
    delete process.env.URBAN_TEST_INJECT_AUTHZ_BUILD_THROW;
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe(URBAN_OWNER_REQUIRED);
  });

  it("ASM-8.1-014 PATCH /urban/settings malformed authz context maps to 403 URBAN_OWNER_REQUIRED", async () => {
    process.env.URBAN_TEST_INJECT_AUTHZ_BUILD_THROW = "1";
    const response = await requestUrban(listener, "PATCH", urbanBearer("owner"), {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open" },
      },
    });
    delete process.env.URBAN_TEST_INJECT_AUTHZ_BUILD_THROW;
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe(URBAN_OWNER_REQUIRED);
  });

  it("ASM-8.1-018 GET /urban/settings assert regression returns 500 INTERNAL_SERVER_ERROR", async () => {
    process.env.URBAN_TEST_INJECT_ASSERT_OWNER_THROW = "1";
    const response = await requestUrban(listener, "GET", urbanBearer("owner"));
    delete process.env.URBAN_TEST_INJECT_ASSERT_OWNER_THROW;
    expect(response.status).toBe(500);
    expect((response.body as { error?: string }).error).toBe("INTERNAL_SERVER_ERROR");
  });

  it("ASM-8.1-019 PATCH /urban/settings assert regression returns 500 INTERNAL_SERVER_ERROR", async () => {
    process.env.URBAN_TEST_INJECT_ASSERT_OWNER_THROW = "1";
    const response = await requestUrban(listener, "PATCH", urbanBearer("owner"), {
      urban: {
        catalog: { publicEnabled: true, slug: "catalog" },
        registration: { policy: "open" },
      },
    });
    delete process.env.URBAN_TEST_INJECT_ASSERT_OWNER_THROW;
    expect(response.status).toBe(500);
    expect((response.body as { error?: string }).error).toBe("INTERNAL_SERVER_ERROR");
  });

  it("ASM-8.1-020 GET /urban/settings starter workspace owner returns 403 URBAN_OWNER_REQUIRED", async () => {
    const starterTenantId = "00000000-0000-4000-8000-000000000099";
    const response = await requestUrban(listener, "GET", urbanBearer("owner", starterTenantId));
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });
});

describe("Phase 8.1 — ASM canLoadUrbanSettings contract (021..024)", () => {
  it("ASM-8.1-021 member canLoadUrbanSettings returns false", () => {
    const auth = {
      userId: URBAN_MEMBER_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "member" as const,
      status: "ACTIVE" as const,
      workspaceId: URBAN_WORKSPACE_ID,
    };
    const authz = buildTenantAuthz(auth);
    const allowed = canLoadUrbanSettings({
      authz,
      tenantId: URBAN_TENANT_ID,
      workspaceId: URBAN_WORKSPACE_ID,
      workspaceType: "urban",
      pluginId: "urban",
    });
    expect(allowed).toBe(false);
  });

  it("ASM-8.1-022 admin canLoadUrbanSettings returns false", () => {
    const auth = {
      userId: URBAN_ADMIN_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "admin" as const,
      status: "ACTIVE" as const,
      workspaceId: URBAN_WORKSPACE_ID,
    };
    const authz = buildTenantAuthz(auth);
    const allowed = canLoadUrbanSettings({
      authz,
      tenantId: URBAN_TENANT_ID,
      workspaceId: URBAN_WORKSPACE_ID,
      workspaceType: "urban",
      pluginId: "urban",
    });
    expect(allowed).toBe(false);
  });

  it("ASM-8.1-023 owner canLoadUrbanSettings returns true", () => {
    const auth = {
      userId: URBAN_OWNER_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "owner" as const,
      status: "ACTIVE" as const,
      workspaceId: URBAN_WORKSPACE_ID,
    };
    const authz = buildTenantAuthz(auth);
    const allowed = canLoadUrbanSettings({
      authz,
      tenantId: URBAN_TENANT_ID,
      workspaceId: URBAN_WORKSPACE_ID,
      workspaceType: "urban",
      pluginId: "urban",
    });
    expect(allowed).toBe(true);
  });

  it("ASM-8.1-024 missing authz context canLoadUrbanSettings returns false", () => {
    const auth = {
      userId: URBAN_OWNER_USER_ID,
      tenantId: URBAN_TENANT_ID,
      role: "none" as const,
      status: "ACTIVE" as const,
    };
    const authz = buildTenantAuthz(auth);
    const allowed = canLoadUrbanSettings({
      authz,
      tenantId: URBAN_TENANT_ID,
      workspaceId: undefined,
      workspaceType: "urban",
      pluginId: "urban",
    });
    expect(allowed).toBe(false);
  });
});
