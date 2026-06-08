/**
 * Phase 8.3 — enterprise urban silo tier integration (REQ-P8-030..032)
 * Authority: docs/phase-8/subphases/8.3-silo-tier.md · RULE-P8-006
 */
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import { IncomingMessage } from "node:http";
import { after, before, describe, it } from "node:test";

import { TenantConnectionRouter } from "@app-tour/tenant-kernel";

import { createRequestListener } from "../src/app";
import { runWithHttpRequestContext } from "../src/http/bind-request-context";
import { rateLimitConsumerKey } from "../src/middleware/tenant-rate-limiter";
import { resolveTenantDatabaseUrl } from "../src/tenant/resolve-tenant-database-url";
import {
  installTenantConnectionRouterForTests,
  resetTenantConnectionRouterForTests,
} from "../src/tenant/tenant-connection-router";
import { getActiveTenantTier } from "../src/tenant/tenant-request-context";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import {
  URBAN_SILO_ENTERPRISE_DATABASE_URL,
  URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID,
  URBAN_SILO_ENTERPRISE_ROUTE_ROW,
  URBAN_SILO_ENTERPRISE_TENANT_ID,
} from "./fixtures/urban-silo-enterprise-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const POOL_DATABASE_URL = "postgresql://pool-default:5432/app_tour";

function siloLookup(tenantId: string) {
  if (tenantId === URBAN_SILO_ENTERPRISE_TENANT_ID) {
    return Promise.resolve(URBAN_SILO_ENTERPRISE_ROUTE_ROW);
  }
  return Promise.resolve(null);
}

function installSiloRouterForTests(): void {
  installTenantConnectionRouterForTests(
    new TenantConnectionRouter(siloLookup, POOL_DATABASE_URL)
  );
}

function publicHeaders(tenantId = URBAN_SILO_ENTERPRISE_TENANT_ID): Record<string, string> {
  return { "x-tenant-id": tenantId };
}

async function requestUrban(
  listener: ReturnType<typeof createRequestListener>,
  path: string,
  tenantId = URBAN_SILO_ENTERPRISE_TENANT_ID
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
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method: "GET",
          headers: publicHeaders(tenantId),
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
      req.end();
    });
  });
}

installMemoryStorageDriverForDescribe();

describe("Phase 8.3 — urban silo enterprise fixture", () => {
  let listener: ReturnType<typeof createRequestListener>;
  let tourStore: InMemoryTourRepository;
  let router: TenantConnectionRouter;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    resetTenantConnectionRouterForTests();
    router = new TenantConnectionRouter(siloLookup, POOL_DATABASE_URL);
    installTenantConnectionRouterForTests(router);
    tourStore = new InMemoryTourRepository();
    tourStore.ensureUrbanSiloEnterpriseCatalogFixture();
    listener = createRequestListener({
      toursService: createTestToursService(tourStore),
      tourStore,
    });
  });

  after(() => {
    resetTenantConnectionRouterForTests();
  });

  it("USILO-8.3-01 resolveRoute returns silo tier with dedicated databaseUrl", async () => {
    const route = await router.resolveRoute(URBAN_SILO_ENTERPRISE_TENANT_ID);
    assert.equal(route.tier, "silo");
    assert.equal(route.databaseUrl, URBAN_SILO_ENTERPRISE_DATABASE_URL);
  });

  it("USILO-8.3-02 resolveTenantDatabaseUrl uses router (no handler env silo URL)", async () => {
    const url = await resolveTenantDatabaseUrl(URBAN_SILO_ENTERPRISE_TENANT_ID);
    assert.equal(url, URBAN_SILO_ENTERPRISE_DATABASE_URL);
  });

  it("USILO-8.3-03 HTTP context binds ALS tenantTier silo", async () => {
    const req = new IncomingMessage(new EventEmitter() as NodeJS.ReadableStream);
    req.method = "GET";
    req.url = "/urban/catalog";
    await runWithHttpRequestContext(
      req,
      {
        tenantId: URBAN_SILO_ENTERPRISE_TENANT_ID,
        userId: "00000000-0000-4000-0000-000000000001",
        role: "none",
        status: "ACTIVE",
      },
      async () => {
        assert.equal(getActiveTenantTier(), "silo");
      }
    );
  });

  it("USILO-8.3-04 GET /urban/catalog succeeds on silo enterprise tenant", async () => {
    const response = await requestUrban(listener, "/urban/catalog");
    assert.equal(response.status, 200);
    const items = (response.body as { data?: { items?: { id: string }[] } }).data?.items ?? [];
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID);
  });

  it("USILO-8.3-05 rate-limit key includes silo connection tier", () => {
    const key = rateLimitConsumerKey(URBAN_SILO_ENTERPRISE_TENANT_ID, "silo", "read", {
      method: "GET",
      path: "/urban/catalog",
    });
    assert.match(key, /:silo:/);
    assert.equal(
      key,
      `${URBAN_SILO_ENTERPRISE_TENANT_ID}:silo:read:GET:/urban/catalog`
    );
  });

  it("USILO-8.3-06 pool default unchanged for non-silo tenant", async () => {
    const poolTenantId = "00000000-0000-4000-8000-000000000099";
    const route = await router.resolveRoute(poolTenantId);
    assert.equal(route.tier, "pool");
    assert.equal(route.databaseUrl, POOL_DATABASE_URL);
  });
});
