/**
 * Dynamic tenant config sync — integration proof for MAP 4.4 / TH-1.
 *
 * Proves whether GET /api/v2/tenant-config reflects live Postgres `tenants.theme`
 * (and `workspace_type`) without process restart, while other tenants stay isolated.
 *
 * Read path (2026-06, post HT-01):
 *   tenant-config.routes.ts → resolveRegisteredTenantById / BySubdomain
 *   → Postgres `tenants` when DATABASE_URL set; static DEV_TENANTS only when
 *     isStaticTenantRegistryAllowed() (test, or dev without DATABASE_URL).
 *
 * Dynamic sync proof: mid-load admin UPDATE to tenants.theme must appear on
 * subsequent GET /api/v2/tenant-config without process restart (invalidate
 * PERF-1 registry cache after admin write — 5s TTL otherwise serves stale theme).
 *
 * Run:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev' \
 *     pnpm --filter @apps/api exec node --import tsx --test \
 *     test/4-integration/dynamic-config-sync.spec.ts
 *
 * @see docs/phase-4/subphases/4.4-tenant-theme.md (4.4-S1: TenantThemeConfig from DB)
 * @see apps/api/test/tenant-config.spec.ts (static registry baseline)
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { resetTenantRegistryCacheForTests } from "../../src/tenant/tenant-registry-cache";
import {
  PHASE_43_SEED_SUBDOMAINS,
  ProvisioningService,
} from "../../src/internal/provisioning.service";
import { createTestToursService } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const TENANT_A_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_B_ID = "00000000-0000-4000-8000-000000000002";

/** Static registry baseline (tenant-registry.ts DEV_TENANTS). */
const REGISTRY_THEME_A = "#2563eb";
const REGISTRY_THEME_B = "#dc2626";

/** Value written to Postgres mid-load — must differ from registry baseline. */
const DB_THEME_A_UPDATED = "#10b981";
const DB_WORKSPACE_A_UPDATED = "premium";

const LOAD_REQUEST_COUNT = 16;
const UPDATE_AT_REQUEST = 8;

type TenantConfigBody = {
  readonly tenantId?: string;
  readonly subdomain?: string;
  readonly workspaceType?: string;
  readonly theme?: { readonly primaryColor?: string };
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    host: tenantId === TENANT_A_ID ? "tenant-a.localhost:3001" : "tenant-b.localhost:3001",
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "dynamic-config-sync",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

async function getTenantConfig(
  server: http.Server,
  tenantId: string
): Promise<{ readonly status: number; readonly body: TenantConfigBody }> {
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("dynamic-config-sync: server not listening");
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path: "/api/v2/tenant-config",
        method: "GET",
        headers: authHeaders(tenantId),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            body: raw.length > 0 ? (JSON.parse(raw) as TenantConfigBody) : {},
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

describe(
  "4-integration — dynamic tenant config sync (DB update → API without restart)",
  { skip: !hasDatabase ? "requires DATABASE_URL" : false, concurrency: false },
  () => {
    let server: http.Server;
    const envSnapshot = { NODE_ENV: process.env.NODE_ENV };

    before(async () => {
      process.env.NODE_ENV = "development";
      await new ProvisioningService().seedDevTenants();

      const admin = getPrismaAdmin();
      await admin.tenant.update({
        where: { id: TENANT_A_ID },
        data: {
          theme: {
            primaryColor: REGISTRY_THEME_A,
            cssVariables: { "--color-primary": REGISTRY_THEME_A },
          },
          workspaceType: "starter",
        },
      });
      await admin.tenant.update({
        where: { id: TENANT_B_ID },
        data: {
          theme: {
            primaryColor: REGISTRY_THEME_B,
            cssVariables: { "--color-primary": REGISTRY_THEME_B },
          },
          workspaceType: "starter",
        },
      });

      const listener = createRequestListener({ toursService: createTestToursService() });
      server = http.createServer(listener);
      await new Promise<void>((resolve) => server.listen(0, resolve));
    });

    after(async () => {
      process.env.NODE_ENV = envSnapshot.NODE_ENV;
      resetTenantRegistryCacheForTests();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      const admin = getPrismaAdmin();
      await admin.tenant.update({
        where: { id: TENANT_A_ID },
        data: {
          theme: {
            primaryColor: REGISTRY_THEME_A,
            cssVariables: { "--color-primary": REGISTRY_THEME_A },
          },
          workspaceType: "starter",
        },
      });
      await admin.tenant.deleteMany({
        where: { subdomain: { in: [...PHASE_43_SEED_SUBDOMAINS] } },
      });
      await disconnectPrisma();
    });

    it("baseline: tenant-config returns distinct themes for tenant-a and tenant-b", async () => {
      const [resA, resB] = await Promise.all([
        getTenantConfig(server, TENANT_A_ID),
        getTenantConfig(server, TENANT_B_ID),
      ]);

      assert.equal(resA.status, 200);
      assert.equal(resB.status, 200);
      assert.equal(resA.body.theme?.primaryColor, REGISTRY_THEME_A);
      assert.equal(resB.body.theme?.primaryColor, REGISTRY_THEME_B);
      assert.notEqual(
        resA.body.theme?.primaryColor,
        resB.body.theme?.primaryColor,
        "tenants must remain visually distinct at baseline"
      );
    });

    it("dynamic sync: tenant-a reflects DB theme + workspaceType after mid-load admin update", async () => {
      const admin = getPrismaAdmin();
      let dbUpdated = false;
      const tenantAThemes: Array<string | undefined> = [];
      const tenantBThemes: Array<string | undefined> = [];

      for (let i = 0; i < LOAD_REQUEST_COUNT; i += 1) {
        if (i === UPDATE_AT_REQUEST && !dbUpdated) {
          await admin.tenant.update({
            where: { id: TENANT_A_ID },
            data: {
              theme: {
                primaryColor: DB_THEME_A_UPDATED,
                cssVariables: { "--color-primary": DB_THEME_A_UPDATED },
              },
              workspaceType: DB_WORKSPACE_A_UPDATED,
            },
          });
          resetTenantRegistryCacheForTests();
          dbUpdated = true;
        }

        const [resA, resB] = await Promise.all([
          getTenantConfig(server, TENANT_A_ID),
          getTenantConfig(server, TENANT_B_ID),
        ]);
        assert.equal(resA.status, 200);
        assert.equal(resB.status, 200);
        tenantAThemes.push(resA.body.theme?.primaryColor);
        tenantBThemes.push(resB.body.theme?.primaryColor);
      }

      assert.ok(dbUpdated, "DB row must be updated during load loop");

      const postUpdateThemes = tenantAThemes.slice(UPDATE_AT_REQUEST + 1);
      const postUpdateWorkspaceTypes: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const res = await getTenantConfig(server, TENANT_A_ID);
        postUpdateWorkspaceTypes.push(res.body.workspaceType ?? "");
      }

      const tenantASawUpdate = postUpdateThemes.some((c) => c === DB_THEME_A_UPDATED);
      const tenantBUnchanged = tenantBThemes.every((c) => c === REGISTRY_THEME_B);

      assert.ok(
        tenantBUnchanged,
        `tenant-b theme must stay ${REGISTRY_THEME_B} while tenant-a DB row changes; got ${JSON.stringify(tenantBThemes)}`
      );

      assert.ok(
        tenantASawUpdate,
        [
          "tenant-a primaryColor must reflect Postgres tenants.theme after DB update;",
          `expected ${DB_THEME_A_UPDATED}; observed post-update: ${JSON.stringify(postUpdateThemes)}.`,
        ].join(" ")
      );

      assert.ok(
        postUpdateWorkspaceTypes.some((ws) => ws === DB_WORKSPACE_A_UPDATED),
        `workspaceType should reflect DB update (${DB_WORKSPACE_A_UPDATED}); got ${JSON.stringify(postUpdateWorkspaceTypes)}`
      );
    });
  }
);
