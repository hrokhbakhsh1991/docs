/**
 * Postgres fixtures for operator ticketing Playwright smoke (operator tenant …000014).
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import http from "node:http";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant";
import { seedOperatorSmokeIdentity } from "./seed-operator-smoke-identity-staging";
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

const VIEWER_USER_ID = "00000000-0000-4000-8000-000000000104";
const VIEWER_MOBILE = "+15550001004";

async function enableTicketingModule(admin: PrismaClient): Promise<void> {
  const row = await admin.tenant.findUnique({
    where: { id: OPERATOR_SMOKE.tenantId },
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
        ]),
      ]
    : ["ticketing"];
  await admin.tenant.upsert({
    where: { id: OPERATOR_SMOKE.tenantId },
    create: {
      id: OPERATOR_SMOKE.tenantId,
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

async function ensureViewerUser(admin: PrismaClient): Promise<void> {
  await admin.user.upsert({
    where: { id: VIEWER_USER_ID },
    create: {
      id: VIEWER_USER_ID,
      mobile: VIEWER_MOBILE,
    },
    update: {
      mobile: VIEWER_MOBILE,
    },
  });
  await admin.userTenant.upsert({
    where: {
      userId_tenantId: {
        tenantId: OPERATOR_SMOKE.tenantId,
        userId: VIEWER_USER_ID,
      },
    },
    create: {
      tenantId: OPERATOR_SMOKE.tenantId,
      userId: VIEWER_USER_ID,
      role: "viewer",
      status: "ACTIVE",
    },
    update: {
      role: "viewer",
      status: "ACTIVE",
    },
  });
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly userId: string;
    readonly role: "admin" | "owner" | "member" | "viewer";
    readonly body?: unknown;
    readonly idempotencyKey?: string;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = input.body === undefined ? undefined : JSON.stringify(input.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: {
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
            ...(input.idempotencyKey !== undefined ? { "idempotency-key": input.idempotencyKey } : {}),
            "x-tenant-id": OPERATOR_SMOKE.tenantId,
            "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
            "x-user-id": input.userId,
            "x-actor-role": input.role,
            "x-membership-status": "ACTIVE",
            "x-workspace-id": "ws-operator-ticketing-smoke",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            let body: Record<string, unknown> = {};
            if (text.length > 0) {
              body = JSON.parse(text) as Record<string, unknown>;
            }
            resolve({ status: res.statusCode ?? 0, body });
          });
        },
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  });
}

async function seedOperationalArtifacts(listener: ReturnType<typeof createRequestListener>): Promise<void> {
  const tag = await requestJson(listener, {
    method: "POST",
    path: "/ticket-tags",
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin",
    idempotencyKey: `seed-tag-${randomUUID()}`,
    body: { code: "smoke-urgent", label: "Smoke urgent" },
  });
  if (tag.status !== 201 && tag.body.code !== "TICKET_DUPLICATE_TAG") {
    throw new Error(`seed tag failed: ${tag.status} ${JSON.stringify(tag.body)}`);
  }

  const team = await requestJson(listener, {
    method: "POST",
    path: "/ticket-teams",
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin",
    idempotencyKey: `seed-team-${randomUUID()}`,
    body: {
      code: "smoke-team",
      name: "Smoke team",
    },
  });
  if (team.status !== 201 && team.body.code !== "TICKET_DUPLICATE_TEAM" && team.body.code !== "UNIQUE_CONSTRAINT_VIOLATION") {
    throw new Error(`seed team failed: ${team.status} ${JSON.stringify(team.body)}`);
  }

  const queue = await requestJson(listener, {
    method: "POST",
    path: "/ticket-queues",
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin",
    idempotencyKey: `seed-queue-${randomUUID()}`,
    body: { code: "smoke-queue", name: "Smoke queue", teamCode: "smoke-team" },
  });
  if (queue.status !== 201 && queue.body.code !== "TICKET_DUPLICATE_QUEUE" && queue.body.code !== "UNIQUE_CONSTRAINT_VIOLATION") {
    throw new Error(`seed queue failed: ${queue.status} ${JSON.stringify(queue.body)}`);
  }
}

async function seedMemberTicket(listener: ReturnType<typeof createRequestListener>): Promise<string> {
  const subject = `TKT-OP-SMOKE-${Date.now()}`;
  const created = await requestJson(listener, {
    method: "POST",
    path: "/member/tickets",
    userId: OPERATOR_SMOKE.memberUserId,
    role: "member",
    idempotencyKey: `seed-ticket-${randomUUID()}`,
    body: {
      categoryCode: "general",
      subject,
      body: "Operator inbox smoke seed ticket.",
    },
  });
  if (created.status !== 201) {
    throw new Error(`seed ticket failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const envelope = created.body.ticket as Record<string, unknown>;
  const ticket = envelope.ticket as Record<string, unknown>;
  return ticket.id as string;
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!adminUrl?.trim()) {
    throw new Error("seed-operator-ticketing-e2e-fixtures: DATABASE_URL_ADMIN required");
  }

  process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER?.trim() || "prisma";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? adminUrl;

  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    await admin.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO app_tour`);
    await seedOperatorSmokeIdentity();
    await enableTicketingModule(admin);
    await ensureAdminMemberUsers(admin);
    await ensureViewerUser(admin);

    await runWithTenantContext(OPERATOR_SMOKE_TENANT_ID, async () => {
      const repo = getSettingsResourcesRepository();
      await seedOperatorSmokeCatalog(repo, { tenantId: OPERATOR_SMOKE_TENANT_ID });
      await seedOperatorSmokePublishedTour(OPERATOR_SMOKE_TENANT_ID);
      await ensureOperatorSmokePublishedTourEditReady(OPERATOR_SMOKE_TENANT_ID);
    });

    const listener = createRequestListener();
    await seedOperationalArtifacts(listener);
    const ticketId = await seedMemberTicket(listener);
    console.log(
      `seed-operator-ticketing-e2e-fixtures: ready (viewer=${VIEWER_MOBILE}, ticket=${ticketId})`,
    );
  } finally {
    await admin.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
