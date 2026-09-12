/**
 * Postgres fixtures for portal ticketing Playwright smoke (operator tenant …000014).
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import http from "node:http";

import { createRequestListener } from "../src/app";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import {
  OPERATOR_SMOKE_TENANT_ID,
  seedOperatorSmokeCatalog,
} from "../src/settings/seed-operator-smoke-catalog";
import {
  ensureOperatorSmokePublishedTourEditReady,
  seedOperatorSmokePublishedTour,
} from "../src/settings/seed-operator-smoke-published-tour";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant";
import { seedOperatorSmokeIdentity } from "./seed-operator-smoke-identity-staging";

const OPERATOR_SMOKE_TENANT_ID_CONST = "00000000-0000-4000-8000-000000000014";

async function createMemberTicketFixture(
  listener: ReturnType<typeof createRequestListener>
): Promise<void> {
  const payload = JSON.stringify({
    categoryCode: "general",
    subject: `TKT-PORTAL-SMOKE-${Date.now()}`,
    body: "Portal member ticket walkthrough seed.",
  });
  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("seed-portal-ticketing-e2e-fixtures: no listener address"));
        return;
      }
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path: "/member/tickets",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            "idempotency-key": `seed-portal-ticket-${randomUUID()}`,
            "x-tenant-id": OPERATOR_SMOKE_TENANT_ID_CONST,
            "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID_CONST,
            "x-user-id": OPERATOR_SMOKE.memberUserId,
            "x-actor-role": "member",
            "x-membership-status": "ACTIVE",
            "x-workspace-id": "ws-operator-ticketing-smoke",
          },
        },
        (response) => {
          response.resume();
          response.on("end", () => {
            server.close();
            if (response.statusCode !== 201) {
              reject(
                new Error(
                  `seed-portal-ticketing-e2e-fixtures: member ticket failed (${response.statusCode})`
                )
              );
              return;
            }
            resolve();
          });
        }
      );
      request.on("error", (error) => {
        server.close();
        reject(error);
      });
      request.write(payload);
      request.end();
    });
  });
}

async function enableTicketingModule(admin: PrismaClient): Promise<void> {
  const row = await admin.tenant.findUnique({
    where: { id: OPERATOR_SMOKE_TENANT_ID_CONST },
    select: { theme: true },
  });
  const theme =
    row?.theme !== null && typeof row?.theme === "object" && !Array.isArray(row.theme)
      ? { ...(row.theme as Record<string, unknown>) }
      : {};
  const enabledModules = Array.isArray(theme.enabledModules)
    ? [
        ...new Set([
          ...theme.enabledModules.filter((v): v is string => typeof v === "string"),
          "ticketing",
          "finance",
          "wallet",
          "engagement",
        ]),
      ]
    : ["ticketing", "finance", "wallet", "engagement"];
  await admin.tenant.upsert({
    where: { id: OPERATOR_SMOKE_TENANT_ID_CONST },
    create: {
      id: OPERATOR_SMOKE_TENANT_ID_CONST,
      subdomain: "operator",
      workspaceType: "denali",
      theme: { ...theme, enabledModules },
    },
    update: {
      theme: { ...theme, enabledModules },
    },
  });
}

async function ensureAdminMemberUsers(admin: PrismaClient): Promise<void> {
  await admin.user.upsert({
    where: { id: OPERATOR_SMOKE.adminUserId },
    create: {
      id: OPERATOR_SMOKE.adminUserId,
      mobile: OPERATOR_SMOKE.adminMobile,
    },
    update: {
      mobile: OPERATOR_SMOKE.adminMobile,
    },
  });
  await admin.user.upsert({
    where: { id: OPERATOR_SMOKE.memberUserId },
    create: {
      id: OPERATOR_SMOKE.memberUserId,
      mobile: OPERATOR_SMOKE.memberMobile,
    },
    update: {
      mobile: OPERATOR_SMOKE.memberMobile,
    },
  });
  await admin.userTenant.upsert({
    where: {
      userId_tenantId: {
        tenantId: OPERATOR_SMOKE.tenantId,
        userId: OPERATOR_SMOKE.adminUserId,
      },
    },
    create: {
      tenantId: OPERATOR_SMOKE.tenantId,
      userId: OPERATOR_SMOKE.adminUserId,
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-operator-smoke-admin",
    },
    update: {
      role: "admin",
      status: "ACTIVE",
    },
  });
  await admin.userTenant.upsert({
    where: {
      userId_tenantId: {
        tenantId: OPERATOR_SMOKE.tenantId,
        userId: OPERATOR_SMOKE.memberUserId,
      },
    },
    create: {
      tenantId: OPERATOR_SMOKE.tenantId,
      userId: OPERATOR_SMOKE.memberUserId,
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-operator-smoke-member",
    },
    update: {
      role: "member",
      status: "ACTIVE",
    },
  });
}

async function grantSmokeMemberPortalModuleGrants(admin: PrismaClient): Promise<void> {
  const existing = await admin.userTenant.findUnique({
    where: {
      userId_tenantId: {
        userId: OPERATOR_SMOKE.memberUserId,
        tenantId: OPERATOR_SMOKE.tenantId,
      },
    },
    select: { membershipMetadata: true },
  });
  if (existing === null) {
    throw new Error("seed-portal-ticketing-e2e-fixtures: operator smoke member membership missing");
  }

  const metadata =
    existing.membershipMetadata !== null &&
    typeof existing.membershipMetadata === "object" &&
    !Array.isArray(existing.membershipMetadata)
      ? { ...(existing.membershipMetadata as Record<string, unknown>) }
      : {};

  await admin.userTenant.update({
    where: {
      userId_tenantId: {
        userId: OPERATOR_SMOKE.memberUserId,
        tenantId: OPERATOR_SMOKE.tenantId,
      },
    },
    data: {
      membershipMetadata: {
        ...metadata,
        portalModuleGrants: ["wallet", "engagement"],
      },
    },
  });
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!adminUrl?.trim()) {
    throw new Error("seed-portal-ticketing-e2e-fixtures: DATABASE_URL_ADMIN required");
  }

  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    await admin.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO app_tour`);
    await enableTicketingModule(admin);
    await seedOperatorSmokeIdentity();
    await ensureAdminMemberUsers(admin);
    await grantSmokeMemberPortalModuleGrants(admin);

    await runWithTenantContext(OPERATOR_SMOKE_TENANT_ID, async () => {
      const repo = getSettingsResourcesRepository();
      await seedOperatorSmokeCatalog(repo, { tenantId: OPERATOR_SMOKE_TENANT_ID });
      await seedOperatorSmokePublishedTour(OPERATOR_SMOKE_TENANT_ID);
      await ensureOperatorSmokePublishedTourEditReady(OPERATOR_SMOKE_TENANT_ID);
    });

    await createMemberTicketFixture(createRequestListener());

    console.log("seed-portal-ticketing-e2e-fixtures: operator smoke + ticketing ready");
  } finally {
    await admin.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
