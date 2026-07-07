/**
 * 4-integration — exposure intent lifecycle on integration connection delete (Phase 9.5a).
 *
 * Run:
 *   DATABASE_URL='postgresql://...' STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api run test:exposure:integration
 *
 * @see docs/architecture/field-exposure-system.md — Phase 9.5a
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

function authHeaders(tenantId: string, userId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "denali",
  };
}

async function request(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
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
        reject(new Error("field-exposure-lifecycle: no listen address"));
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
            ...authHeaders(input.tenantId, input.userId),
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
  "4-integration — field exposure lifecycle",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for exposure lifecycle (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    const connectionId = randomUUID();
    const actorUserId = randomUUID();
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
          subdomain: `exposure-lifecycle-${runId}`,
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
          config: { channelId: "@exposure-lifecycle-test" },
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

    it("deletes connection-scoped exposure intents when integration connection is deleted", async () => {
      const patch = await request(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourPublished`,
        tenantId,
        userId: actorUserId,
        body: {
          enabled: true,
          selectedFieldIds: ["title"],
        },
      });
      assert.equal(patch.status, 200, JSON.stringify(patch.body));

      const beforeDelete = await admin.exposureIntent.findMany({
        where: { tenantId },
      });
      assert.ok(
        beforeDelete.some(
          (row) =>
            typeof row.scope === "object" &&
            row.scope !== null &&
            !Array.isArray(row.scope) &&
            (row.scope as Record<string, unknown>).connectionId === connectionId,
        ),
      );

      const deleted = await request(listener, {
        method: "DELETE",
        path: `/integrations/${connectionId}`,
        tenantId,
        userId: actorUserId,
      });
      assert.equal(deleted.status, 204, JSON.stringify(deleted.body));

      const remaining = await admin.exposureIntent.findMany({
        where: { tenantId },
      });
      assert.equal(
        remaining.filter(
          (row) =>
            typeof row.scope === "object" &&
            row.scope !== null &&
            !Array.isArray(row.scope) &&
            (row.scope as Record<string, unknown>).connectionId === connectionId,
        ).length,
        0,
      );

      const connection = await admin.integrationConnection.findFirst({
        where: { id: connectionId, tenantId },
      });
      assert.equal(connection, null);
    });
  },
);
