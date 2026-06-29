/**
 * 4-integration — PATCH /integrations/:id/exposure-intents/:eventType persists native intents.
 *
 * Run:
 *   DATABASE_URL='postgresql://...' STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api run test:exposure:integration
 *
 * @see docs/architecture/field-exposure-system.md — Milestone M1 (Phase 9.0)
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

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "field-exposure-intent-patch",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-field-exposure-intent",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly body?: unknown;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("field-exposure-intent-patch: no listen address"));
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
            ...authHeaders(input.tenantId),
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
  "4-integration — field exposure intent PATCH",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for exposure intents (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    const connectionId = randomUUID();
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
          subdomain: `exposure-intent-${runId}`,
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
          config: { channelId: "@exposure-intent-test" },
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

    it("persists selectedFieldIds on PATCH and returns them on GET detail", async () => {
      const patch = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourCreated`,
        tenantId,
        body: {
          enabled: true,
          selectedFieldIds: ["title", "datetime"],
        },
      });

      assert.equal(patch.status, 200, JSON.stringify(patch.body));
      const patchIntents = patch.body.exposureIntents;
      assert.ok(Array.isArray(patchIntents));
      const patched = (patchIntents as Array<Record<string, unknown>>).find(
        (intent) => intent.eventType === "TourCreated",
      );
      assert.ok(patched);
      assert.deepEqual(patched?.selectedFieldIds, ["title", "datetime"]);

      const detail = await requestJson(listener, {
        method: "GET",
        path: `/integrations/${connectionId}`,
        tenantId,
      });
      assert.equal(detail.status, 200, JSON.stringify(detail.body));
      const detailIntents = detail.body.exposureIntents;
      assert.ok(Array.isArray(detailIntents));
      const loaded = (detailIntents as Array<Record<string, unknown>>).find(
        (intent) => intent.eventType === "TourCreated",
      );
      assert.ok(loaded);
      assert.deepEqual(loaded?.selectedFieldIds, ["title", "datetime"]);
    });
  },
);
