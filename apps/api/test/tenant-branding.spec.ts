/**
 * Tenant branding API — production closure Phase 3–4
 * @see docs/workspaces/tenant-branding.md
 */
import assert from "node:assert/strict";
import http, { type Server } from "node:http";
import { after, before, describe, it } from "node:test";

import { buildTenantBrandLogoObjectKey } from "@app-tour/workspace-sdk";

import { DENALI_CLUB_PUBLIC_DISPLAY_NAME } from "../src/tenant/tenant-registry";
import { createRequestListener } from "../src/app";
import { resetIdentityRepositoryForTests } from "../src/identity/create-identity-repository";
import { updateTenantRegistryRow } from "../src/tenant/update-tenant-registry-row";
import { readTenantBrandLogoMinioConfigFromEnv, putTenantBrandLogo } from "../src/tenant/tenant-branding-storage";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import {
  isMinioEnvironmentFailure,
  minioEnvironmentSkipReason,
} from "./lib/minio-environment-skip";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

const minioConfig = readTenantBrandLogoMinioConfigFromEnv();
const minioSkip = minioConfig === null ? "MINIO_* env not set" : false;

installMemoryStorageDriverForDescribe();

type BrandingResponse = {
  readonly displayName?: string | null;
  readonly logo?: { readonly storageKey?: string } | null;
  readonly code?: string;
};

function createBrandingTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

function ownerHeaders(tenantId = OPERATOR_SMOKE.tenantId): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": OPERATOR_SMOKE.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-smoke",
  };
}

function memberHeaders(): Record<string, string> {
  return {
    ...ownerHeaders(),
    "x-user-id": OPERATOR_SMOKE.memberUserId,
    "x-actor-role": "member",
  };
}

function urbanOwnerHeaders(): Record<string, string> {
  return {
    "x-tenant-id": URBAN_SMOKE_E2E.tenantId,
    "x-authenticated-tenant-id": URBAN_SMOKE_E2E.tenantId,
    "x-user-id": URBAN_SMOKE_E2E.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": URBAN_SMOKE_E2E.workspaceId,
  };
}

async function requestHttp(
  port: number,
  method: string,
  path: string,
  options?: { readonly headers?: Record<string, string>; readonly body?: Buffer | string }
): Promise<{ readonly status: number; readonly body: BrandingResponse }> {
  const payload =
    options?.body === undefined
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : options.body;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          Connection: "close",
          ...options?.headers,
          ...(payload !== undefined
            ? {
                "Content-Length": String(
                  typeof payload === "string" ? Buffer.byteLength(payload) : payload.length
                ),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: BrandingResponse = {};
          if (text.length > 0) {
            try {
              body = JSON.parse(text) as BrandingResponse;
            } catch {
              body = { code: text };
            }
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      }
    );
    req.on("error", reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

describe("tenant-branding.spec.ts", () => {
  let server: Server;
  let port = 0;

  before(async () => {
    server = http.createServer(createBrandingTestListener());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("tenant-branding.spec: no listen address");
    }
    port = addr.port;
  });

  after(async () => {
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  before(() => {
    const repo = resetIdentityRepositoryForTests();
    repo.seedUser({ id: OPERATOR_SMOKE.ownerUserId, mobile: OPERATOR_SMOKE.ownerMobile });
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: "+15550001003" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-smoke",
    });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-smoke",
    });
    repo.seedUser({ id: URBAN_SMOKE_E2E.ownerUserId, mobile: "+15550004001" });
    repo.seedMembership({
      userId: URBAN_SMOKE_E2E.ownerUserId,
      tenantId: URBAN_SMOKE_E2E.tenantId,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: URBAN_SMOKE_E2E.workspaceId,
    });
  });

  it("API-TB-01 GET /settings/branding requires session", async () => {
    const response = await requestHttp(port, "GET", "/settings/branding");
    assert.equal(response.status, 401);
  });

  it("API-TB-02 GET /settings/branding member allowed", async () => {
    const response = await requestHttp(port, "GET", "/settings/branding", {
      headers: memberHeaders(),
    });
    assert.equal(response.status, 200);
  });

  it("API-TB-03 PATCH /settings/branding member forbidden", async () => {
    const response = await requestHttp(port, "PATCH", "/settings/branding", {
      headers: {
        ...memberHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Member Try" }),
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "SETTINGS_MUTATION_FORBIDDEN");
  });

  it("API-TB-09 PATCH /settings/branding owner succeeds", async () => {
    const response = await requestHttp(port, "PATCH", "/settings/branding", {
      headers: {
        ...ownerHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Alpine Ops" }),
    });
    assert.equal(response.status, 200);
    assert.ok("displayName" in response.body);
    assert.ok("logo" in response.body);
  });

  it("API-TB-04 POST /settings/branding/logo without Content-Type returns 400", async () => {
    const response = await requestHttp(port, "POST", "/settings/branding/logo", {
      headers: ownerHeaders(),
      body: Buffer.from("not-an-image"),
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "CONTENT_TYPE_REQUIRED");
  });

  it("API-TB-05 POST /settings/branding/logo invalid content-type returns 400", async () => {
    const response = await requestHttp(port, "POST", "/settings/branding/logo", {
      headers: {
        ...ownerHeaders(),
        "Content-Type": "text/plain",
      },
      body: Buffer.from("plain"),
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "TENANT_BRAND_LOGO_CONTENT_TYPE_INVALID");
  });

  it("API-TB-10 urban tenant GET /settings/branding is module unknown", async () => {
    const response = await requestHttp(port, "GET", "/settings/branding", {
      headers: urbanOwnerHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "SETTINGS_MODULE_UNKNOWN");
  });

  it("API-TB-08 GET /public/tenant-branding resolves host label", async () => {
    const response = await requestHttp(port, "GET", "/public/tenant-branding", {
      headers: { host: "denali.localhost" },
    });
    assert.equal(response.status, 200);
    assert.equal((response.body as { primaryColor?: string }).primaryColor, "#059669");
    assert.equal(
      (response.body as { displayName?: string | null }).displayName,
      DENALI_CLUB_PUBLIC_DISPLAY_NAME
    );
  });

  it("GL-BRAND-02 GET /public/tenant-branding operator smoke has no club displayName", async () => {
    const response = await requestHttp(port, "GET", "/public/tenant-branding", {
      headers: { host: "operator.localhost" },
    });
    assert.equal(response.status, 200);
    assert.equal((response.body as { displayName?: string | null }).displayName, null);
  });

  it("API-TB-14 GET /public/tenant-branding resolves x-forwarded-host (BFF loopback)", async () => {
    const response = await requestHttp(port, "GET", "/public/tenant-branding", {
      headers: { host: "127.0.0.1:3001", "x-forwarded-host": "denali.localhost" },
    });
    assert.equal(response.status, 200);
    assert.equal((response.body as { primaryColor?: string }).primaryColor, "#059669");
  });

  it("API-TB-15 GET /public/tenant-branding exposes defaultLocale", async () => {
    const response = await requestHttp(port, "GET", "/public/tenant-branding", {
      headers: { host: "urban.localhost" },
    });
    assert.equal(response.status, 200);
    assert.equal((response.body as { defaultLocale?: string }).defaultLocale, "en");
    assert.equal((response.body as { primaryColor?: string }).primaryColor, "#0d9488");
  });

  it("API-TB-16 GET /public/tenant-branding urban host returns workspace colors", async () => {
    const response = await requestHttp(port, "GET", "/public/tenant-branding", {
      headers: { host: "urban.localhost" },
    });
    assert.equal(response.status, 200);
    const body = response.body as { primaryColor?: string; defaultLocale?: string };
    assert.equal(body.primaryColor, "#0d9488");
    assert.equal(body.defaultLocale, "en");
  });

  it("API-TB-17 GET /public/tenant-branding urban x-forwarded-host (BFF loopback)", async () => {
    const response = await requestHttp(port, "GET", "/public/tenant-branding", {
      headers: { host: "127.0.0.1:3001", "x-forwarded-host": "urban.localhost" },
    });
    assert.equal(response.status, 200);
    const body = response.body as { primaryColor?: string; defaultLocale?: string };
    assert.equal(body.primaryColor, "#0d9488");
    assert.equal(body.defaultLocale, "en");
  });

  it("API-TB-06 GET /settings/branding/logo/url without logo returns 404", async () => {
    const response = await requestHttp(port, "GET", "/settings/branding/logo/url", {
      headers: memberHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "TENANT_BRAND_LOGO_NOT_SET");
  });

  it("API-TB-11 POST /settings/branding/logo member forbidden", async () => {
    const response = await requestHttp(port, "POST", "/settings/branding/logo", {
      headers: {
        ...memberHeaders(),
        "Content-Type": "image/png",
      },
      body: PNG_HEADER,
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "SETTINGS_MUTATION_FORBIDDEN");
  });

  it("API-TB-12 POST /settings/branding/logo bytes/content-type mismatch returns 400", async () => {
    const response = await requestHttp(port, "POST", "/settings/branding/logo", {
      headers: {
        ...ownerHeaders(),
        "Content-Type": "image/png",
      },
      body: Buffer.from("not-a-png-file"),
    });
    assert.equal(response.status, 400);
    assert.ok(
      response.body.code === "TENANT_BRAND_LOGO_BYTES_UNRECOGNIZED" ||
        response.body.code === "TENANT_BRAND_LOGO_BYTES_CONTENT_TYPE_MISMATCH"
    );
  });

  it("API-TB-05a POST /settings/branding/logo valid PNG without MinIO returns 503", async () => {
    if (minioConfig !== null) {
      return;
    }
    const response = await requestHttp(port, "POST", "/settings/branding/logo", {
      headers: {
        ...ownerHeaders(),
        "Content-Type": "image/png",
      },
      body: PNG_HEADER,
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.code, "MINIO_NOT_CONFIGURED");
  });

  it(
    "API-TB-05b POST /settings/branding/logo owner valid PNG returns 201",
    { skip: minioSkip },
    async (t) => {
      const response = await requestHttp(port, "POST", "/settings/branding/logo", {
        headers: {
          ...ownerHeaders(),
          "Content-Type": "image/png",
        },
        body: PNG_HEADER,
      });
      if (response.status !== 201) {
        try {
          await putTenantBrandLogo({
            tenantId: OPERATOR_SMOKE.tenantId,
            body: PNG_HEADER,
            contentType: "image/png",
          });
        } catch (error) {
          if (isMinioEnvironmentFailure(error)) {
            t.skip(minioEnvironmentSkipReason(error));
            return;
          }
        }
      }
      assert.equal(response.status, 201);
      assert.ok(response.body.logo?.storageKey);
      const urlResponse = await requestHttp(port, "GET", "/settings/branding/logo/url", {
        headers: memberHeaders(),
      });
      assert.equal(urlResponse.status, 200);
    }
  );

  it("API-TB-07 DELETE /settings/branding/logo owner clears theme logo", async () => {
    const storageKey = buildTenantBrandLogoObjectKey(OPERATOR_SMOKE.tenantId);
    await updateTenantRegistryRow(OPERATOR_SMOKE.tenantId, {
      theme: {
        logo: { storageKey, contentType: "image/png" },
      },
    });
    const response = await requestHttp(port, "DELETE", "/settings/branding/logo", {
      headers: ownerHeaders(),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.logo, null);
    const getResponse = await requestHttp(port, "GET", "/settings/branding/logo/url", {
      headers: memberHeaders(),
    });
    assert.equal(getResponse.status, 404);
    assert.equal(getResponse.body.code, "TENANT_BRAND_LOGO_NOT_SET");
  });

  it("API-TB-13 urban tenant PATCH /settings/branding is module unknown", async () => {
    const response = await requestHttp(port, "PATCH", "/settings/branding", {
      headers: {
        ...urbanOwnerHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Urban Try" }),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "SETTINGS_MODULE_UNKNOWN");
  });
});
