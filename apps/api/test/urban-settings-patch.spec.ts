/**
 * Phase 8.1 — urban settings PATCH/GET success + Zod ASM-8.1-001, 002, 015
 * Authority: docs/phase-8/appendices/AGENT-STATE-MAP-8.1.yaml
 * Schema: docs/phase-8/appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import { parseUrbanSettingsPatchBody } from "@app-tour/workspace-urban/host/http";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const URBAN_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";

const VALID_BODY = {
  urban: {
    catalog: { publicEnabled: true, slug: "catalog" },
    registration: { policy: "open" as const },
  },
};

const INVALID_BODY = {
  urban: {
    catalog: { publicEnabled: true, slug: "INVALID_SLUG!" },
    registration: { policy: "open" as const },
  },
};

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
    toMatch(pattern: RegExp | string) {
      assert.match(String(actual), pattern);
    },
  };
}

function ownerBearer(): string {
  return encodeDevBearerToken({
    userId: URBAN_OWNER_USER_ID,
    tenantId: URBAN_TENANT_ID,
    role: "owner",
    status: "ACTIVE",
    workspaceId: URBAN_WORKSPACE_ID,
  });
}

async function requestUrban(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "PATCH",
  authorization: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
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
            Authorization: authorization,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
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

describe("Phase 8.1 — urban settings patch contract parser", () => {
  it("parseUrbanSettingsPatchBody accepts VALID_BODY per URBAN-SETTINGS-PATCH.zod.ts", () => {
    const parsed = parseUrbanSettingsPatchBody(VALID_BODY);
    expect(parsed.urban.catalog.slug).toBe("catalog");
    expect(parsed.urban.registration.policy).toBe("open");
  });

  it("parseUrbanSettingsPatchBody rejects INVALID_BODY with ZOD_VALIDATION_FAILED", () => {
    assert.throws(() => parseUrbanSettingsPatchBody(INVALID_BODY), /ZOD_VALIDATION_FAILED/);
  });
});

describe("Phase 8.1 — ASM urban settings HTTP (001, 002, 015)", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    listener = createRequestListener({ toursService: createTestToursService() });
  });

  it("ASM-8.1-001 GET /urban/settings owner returns 200 envelope success data metadata", async () => {
    const response = await requestUrban(listener, "GET", ownerBearer());
    expect(response.status).toBe(200);
    expect((response.body as { success?: boolean }).success).toBe(true);
    assert.ok(
      typeof (response.body as { data?: { urban?: unknown } }).data?.urban === "object",
      "response.data.urban must be object per URBAN-SETTINGS-HTTP-ENVELOPE.yaml"
    );
    assert.ok(
      typeof (response.body as { metadata?: { tenantId?: string } }).metadata?.tenantId ===
        "string",
      "response.metadata.tenantId must be present"
    );
    expect(
      (response.body as { metadata?: { workspaceType?: string } }).metadata?.workspaceType
    ).toBe("urban");
    const metadata = (response.body as { metadata?: Record<string, unknown> }).metadata;
    assert.ok(metadata && typeof metadata === "object", "metadata object required per envelope");
    assert.ok(
      typeof metadata.correlationId === "string" && metadata.correlationId.length > 0,
      "metadata.correlationId required"
    );
    assert.ok("primaryColor" in metadata, "metadata.primaryColor key required (nullable)");
    assert.ok("featureFlags" in metadata, "metadata.featureFlags key required (nullable)");
    assert.ok("rateLimitRps" in metadata, "metadata.rateLimitRps key required (nullable)");
  });

  it("ASM-8.1-002 PATCH /urban/settings owner valid body returns 200 with urban subtree", async () => {
    const response = await requestUrban(listener, "PATCH", ownerBearer(), VALID_BODY);
    expect(response.status).toBe(200);
    expect(
      (response.body as { urban?: { catalog?: { slug?: string } } }).urban?.catalog?.slug
    ).toBe("catalog");
  });

  it("ASM-8.1-015 PATCH /urban/settings owner invalid slug returns 400 ZOD_VALIDATION_FAILED", async () => {
    const response = await requestUrban(listener, "PATCH", ownerBearer(), INVALID_BODY);
    expect(response.status).toBe(400);
    expect((response.body as { error?: string }).error).toMatch(/ZOD_VALIDATION_FAILED/);
  });

  it("API-8.1-04 member PATCH /urban/settings returns 403 code URBAN_OWNER_REQUIRED", async () => {
    const memberBearer = encodeDevBearerToken({
      userId: "00000000-0000-4000-8000-000000000402",
      tenantId: URBAN_TENANT_ID,
      role: "member",
      status: "ACTIVE",
      workspaceId: URBAN_WORKSPACE_ID,
    });
    const response = await requestUrban(listener, "PATCH", memberBearer, VALID_BODY);
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
    assert.ok(
      typeof (response.body as { correlationId?: string }).correlationId === "string",
      "403 must include correlationId"
    );
  });

  it("API-8.1-05 owner PATCH /urban/settings returns 200", async () => {
    const response = await requestUrban(listener, "PATCH", ownerBearer(), VALID_BODY);
    expect(response.status).toBe(200);
  });
});
