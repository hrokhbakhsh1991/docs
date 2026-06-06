/**
 * 0-functional — tenant/workspace error recovery.
 *
 * Goal: valid tenant auth + invalid or expired workspace id must fail closed with a
 * stable client error — no internal DB/SQL leakage and no ALS/admin context pollution.
 *
 * Project equivalents (until WorkspaceInvalidError lands):
 *   - Malformed workspace id → InvalidTenantAuthContextError / AUTH_SCOPE_ID_INVALID
 *   - Unknown or expired workspace id → WORKSPACE_INVALID (target; not yet enforced)
 *
 * @see apps/api/test/tenant-security.spec.ts — missing workspace header
 * @see apps/api/test/tenant-config.spec.ts — tenant-config happy path
 * @see packages/workspace-sdk/src/auth/auth-id-format.ts — AUTH_SCOPE_ID_PATTERN
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { encodeDevBearerToken } from "../../src/tenant-kernel/parse-bearer";
import { getActiveTenantId } from "../../src/tenant/tenant-request-context";
import { createTestToursService, integrationTenantId } from "../test-helpers";

/** Registered dev tenant for tenant-config host resolution. */
const REGISTERED_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const VALID_WORKSPACE_ID = "ws-recovery-known";

const VALID_TOUR_BODY = {
  data: { basics: { title: "recovery-probe" }, details: { summary: "" } },
} as const;

/** Target error for membership / registry misses (WorkspaceInvalidError alias). */
const WORKSPACE_INVALID = "WORKSPACE_INVALID";

/** SDK auth-scope rejection for malformed workspace ids. */
const AUTH_SCOPE_ID_INVALID = "AUTH_SCOPE_ID_INVALID";

type HttpResult = {
  readonly status: number;
  readonly raw: string;
  readonly body: unknown;
};

const LEAK_PATTERNS: readonly RegExp[] = [
  /^\s*at\s+\S/m,
  /\.tsx?:\d+:\d+/,
  /node_modules\//,
  /postgresql:\/\//i,
  /DATABASE_URL/i,
  /Prisma/i,
  /AsyncLocalStorage/i,
  /getActiveTenantId/i,
  /app\.current_tenant_id/i,
  /SELECT\s+/i,
  /INSERT\s+/i,
  /stack/i,
];

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
};

function memberHeaders(input: {
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly omitWorkspace?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": "recovery-user",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
  };
  if (!input.omitWorkspace) {
    headers["x-workspace-id"] = input.workspaceId ?? VALID_WORKSPACE_ID;
  }
  return headers;
}

function devBearerHeaders(tenantId: string, workspaceId: string): Record<string, string> {
  return {
    Authorization: encodeDevBearerToken({
      userId: "recovery-bearer-user",
      tenantId,
      role: "member",
      status: "ACTIVE",
      workspaceId,
    }),
  };
}

async function requestRaw(
  listener: ReturnType<typeof createRequestListener>,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  }
): Promise<HttpResult> {
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
              raw,
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

function assertNoInternalLeak(result: HttpResult, label: string): void {
  for (const pattern of LEAK_PATTERNS) {
    assert.doesNotMatch(
      result.raw,
      pattern,
      `${label}: response must not match leak pattern ${pattern}`
    );
  }
  assert.doesNotMatch(
    result.raw,
    /(postgres|5434|tour_db|connection string)/i,
    `${label}: response must not expose database connection details`
  );
}

function errorCode(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const record = body as { error?: unknown; code?: unknown };
  if (typeof record.code === "string") return record.code;
  if (typeof record.error === "string") return record.error;
  return "";
}

function assertStructuredWorkspaceAuthError(
  result: HttpResult,
  expectedCode: string,
  label: string
): void {
  assert.ok(
    result.status === 401 || result.status === 403 || result.status === 404,
    `${label}: expected 401/403/404 for workspace auth failure, got ${result.status}`
  );
  const code = errorCode(result.body);
  assert.match(
    code,
    new RegExp(expectedCode),
    `${label}: expected structured error containing ${expectedCode}, got ${code || "(empty)"}`
  );
}

describe("tenant/workspace error recovery (0-functional)", () => {
  let listener: ReturnType<typeof createRequestListener>;
  let validTenantId: string;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.STORAGE_DRIVER = "memory";
    validTenantId = integrationTenantId();
    listener = createRequestListener({
      toursService: createTestToursService(),
    });
  });

  after(() => {
    process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
    process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
    if (ENV_SNAPSHOT.STORAGE_DRIVER === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
    }
  });

  describe("malformed workspace id — auth-scope rejection", () => {
    const malformedIds = ["../evil-workspace", "ws/bad-segment", "!not-a-valid-scope!"] as const;

    for (const workspaceId of malformedIds) {
      it(`POST /tours rejects malformed x-workspace-id=${JSON.stringify(workspaceId)}`, async () => {
        const result = await requestRaw(listener, {
          method: "POST",
          path: "/tours",
          headers: memberHeaders({ tenantId: validTenantId, workspaceId }),
          body: VALID_TOUR_BODY,
        });

        assertNoInternalLeak(result, `malformed-header:${workspaceId}`);
        assertStructuredWorkspaceAuthError(
          result,
          AUTH_SCOPE_ID_INVALID,
          `malformed-header:${workspaceId}`
        );
        assert.equal(
          getActiveTenantId(),
          undefined,
          "ALS must stay unbound after malformed workspace rejection"
        );
      });
    }

    it("POST /tours rejects malformed workspaceId in dev bearer token", async () => {
      const result = await requestRaw(listener, {
        method: "POST",
        path: "/tours",
        headers: devBearerHeaders(validTenantId, "!!!bad-token-workspace!!!"),
        body: VALID_TOUR_BODY,
      });

      assertNoInternalLeak(result, "malformed-bearer");
      assert.ok(result.status === 401, `malformed-bearer: expected 401, got ${result.status}`);
      assert.match(
        errorCode(result.body),
        /AUTH_SCOPE_ID_INVALID|UNAUTHORIZED_INVALID_BEARER_TOKEN/,
        "malformed bearer workspace must map to auth rejection, not 500 leak"
      );
      assert.equal(
        getActiveTenantId(),
        undefined,
        "ALS must stay unbound after bearer workspace rejection"
      );
    });

    it("GET /api/v2/tenant-config rejects malformed x-workspace-id", async () => {
      const result = await requestRaw(listener, {
        method: "GET",
        path: "/api/v2/tenant-config",
        headers: {
          ...memberHeaders({
            tenantId: REGISTERED_TENANT_ID,
            workspaceId: "../tenant-config-evil",
          }),
          host: "tenant-a.localhost:3001",
        },
      });

      assertNoInternalLeak(result, "tenant-config-malformed");
      assertStructuredWorkspaceAuthError(result, AUTH_SCOPE_ID_INVALID, "tenant-config-malformed");
      assert.equal(getActiveTenantId(), undefined);
    });
  });

  describe("unknown or expired workspace id — registry miss (target: WORKSPACE_INVALID)", () => {
    const staleWorkspaceIds = [
      "ws-expired-deadbeef",
      "ws-deleted-00000001",
      "ws-never-provisioned-99",
    ] as const;

    for (const workspaceId of staleWorkspaceIds) {
      it(`POST /tours rejects unregistered workspace ${workspaceId}`, async () => {
        const result = await requestRaw(listener, {
          method: "POST",
          path: "/tours",
          headers: memberHeaders({ tenantId: validTenantId, workspaceId }),
          body: VALID_TOUR_BODY,
        });

        assertNoInternalLeak(result, `stale-header:${workspaceId}`);
        assertStructuredWorkspaceAuthError(
          result,
          WORKSPACE_INVALID,
          `stale-header:${workspaceId}`
        );
        assert.equal(
          getActiveTenantId(),
          undefined,
          "ALS must not retain tenant after workspace registry miss"
        );
      });
    }

    it("POST /tours rejects unregistered workspaceId in dev bearer token", async () => {
      const result = await requestRaw(listener, {
        method: "POST",
        path: "/tours",
        headers: devBearerHeaders(validTenantId, "ws-expired-bearer-only"),
        body: VALID_TOUR_BODY,
      });

      assertNoInternalLeak(result, "stale-bearer");
      assertStructuredWorkspaceAuthError(result, WORKSPACE_INVALID, "stale-bearer");
      assert.equal(getActiveTenantId(), undefined);
    });
  });

  describe("ALS isolation — follow-up under real tenant still works", () => {
    it("valid request succeeds after prior invalid workspace attempt", async () => {
      const rejected = await requestRaw(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({ tenantId: validTenantId, workspaceId: "../evil-pre-check" }),
        body: VALID_TOUR_BODY,
      });
      assert.notEqual(
        rejected.status,
        201,
        "pre-check: malformed workspace must not create a tour"
      );
      assertNoInternalLeak(rejected, "als-pre-check");

      assert.equal(getActiveTenantId(), undefined, "ALS cleared before follow-up request");

      const ok = await requestRaw(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({ tenantId: validTenantId, workspaceId: VALID_WORKSPACE_ID }),
        body: VALID_TOUR_BODY,
      });

      assert.equal(ok.status, 201, "follow-up with valid workspace must succeed");
      assert.equal((ok.body as { tenantId?: string }).tenantId, validTenantId);
      assert.equal(getActiveTenantId(), undefined, "ALS must not leak after successful follow-up");
      assertNoInternalLeak(ok, "follow-up-success");
    });

    it("GET /api/v2/tenant-config succeeds after invalid workspace attempt", async () => {
      await requestRaw(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({ tenantId: validTenantId, workspaceId: "../tenant-config-pre" }),
        body: VALID_TOUR_BODY,
      });

      assert.equal(getActiveTenantId(), undefined);

      const config = await requestRaw(listener, {
        method: "GET",
        path: "/api/v2/tenant-config",
        headers: {
          ...memberHeaders({ tenantId: REGISTERED_TENANT_ID, workspaceId: VALID_WORKSPACE_ID }),
          host: "tenant-a.localhost:3001",
        },
      });

      assert.equal(config.status, 200);
      assert.equal(
        (config.body as { tenantId?: string }).tenantId,
        REGISTERED_TENANT_ID,
        "tenant-config must resolve registered tenant, not global/admin fallback"
      );
      assert.equal(getActiveTenantId(), undefined);
    });
  });
});
