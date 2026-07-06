/**
 * 4-integration — exposure settings RBAC (Phase 9.4).
 *
 * Run:
 *   DATABASE_URL='postgresql://...' STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api run test:exposure:integration
 *
 * @see docs/architecture/field-exposure-system.md — Phase 9.4
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { forceIntegrationSubsystemReadyForTests } from "../../src/health/integration-subsystem-gate";
import { seedDefaultEventPoliciesForConnection } from "../../src/integrations/infrastructure/prisma-integration-policy.repository";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

function authHeaders(
  tenantId: string,
  role: "admin" | "member",
  userId: string,
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": role,
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "denali",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly role: "admin" | "member";
    readonly userId: string;
    readonly body?: unknown;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("field-exposure-rbac: no listen address"));
        return;
      }
      const payload =
        input.body === undefined ? undefined : JSON.stringify(input.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: {
            ...authHeaders(input.tenantId, input.role, input.userId),
            ...(payload === undefined
              ? {}
              : {
                  "content-type": "application/json",
                  "content-length": Buffer.byteLength(payload),
                }),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {},
            });
          });
        },
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  });
}

describe(
  "4-integration — field exposure RBAC",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for exposure RBAC (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    const connectionId = randomUUID();
    const rbacUserIds = {
      admin: randomUUID(),
      member: randomUUID(),
    } as const;
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      forceIntegrationSubsystemReadyForTests();
      await disconnectPrisma();
      admin = getPrismaAdmin();

      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `exposure-rbac-${runId}`,
          workspaceType: "denali",
        },
      });

      await admin.integrationConnection.create({
        data: {
          id: connectionId,
          tenantId,
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: { channelId: "@exposure-rbac-test" },
        },
      });

      await seedDefaultEventPoliciesForConnection({
        tenantId,
        integrationConnectionId: connectionId,
        provider: "telegram",
        workspaceType: "denali",
      });

      listener = createRequestListener();
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      await admin.exposureIntent.deleteMany({ where: { tenantId } });
      await admin.integrationEventPolicy.deleteMany({
        where: { tenantId, integrationConnectionId: connectionId },
      });
      await admin.integrationConnection.deleteMany({ where: { id: connectionId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("allows member read of exposure catalog", async () => {
      const response = await requestJson(listener, {
        method: "GET",
        path: "/workspaces/denali/exposure/catalog",
        tenantId,
        role: "member",
        userId: rbacUserIds.member,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.ok(Array.isArray(response.body.fields));
    });

    it("forbids member PATCH on connection exposure-intent", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourPublished`,
        tenantId,
        role: "member",
        userId: rbacUserIds.member,
        body: {
          enabled: false,
          selectedFieldIds: [],
        },
      });
      assert.equal(response.status, 403);
      assert.equal(response.body.code, "SETTINGS_MUTATION_FORBIDDEN");
    });

    it("allows admin PATCH on connection exposure-intent", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourPublished`,
        tenantId,
        role: "admin",
        userId: rbacUserIds.admin,
        body: {
          enabled: true,
          selectedFieldIds: ["title"],
        },
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
    });

    it("forbids member PATCH on workspace surface exposure-intent", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: "/workspaces/denali/exposure/surfaces/public_list",
        tenantId,
        role: "member",
        userId: rbacUserIds.member,
        body: {
          enabled: true,
          selectedFieldIds: ["title"],
          audience: "public",
          trigger: "always",
        },
      });
      assert.equal(response.status, 403);
      assert.equal(response.body.code, "SETTINGS_MUTATION_FORBIDDEN");
    });
  },
);
