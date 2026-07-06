/**
 * 4-integration — PATCH exposure-intent request body validation.
 *
 * Run:
 *   DATABASE_URL='postgresql://...' STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api run test:exposure:integration
 *
 * @see docs/architecture/field-exposure-system.md — Phase 9.6
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
    "x-user-id": "field-exposure-intent-validation",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-field-exposure-validation",
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
        reject(new Error("field-exposure-intent-validation: no listen address"));
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
  "4-integration — field exposure intent validation",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for exposure intent validation",
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
          subdomain: `exposure-validation-${runId}`,
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
          config: { channelId: "@exposure-validation-test" },
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

    it("rejects unknown selectedFieldIds with 400 invalid_body", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourPublished`,
        tenantId,
        body: {
          enabled: true,
          selectedFieldIds: ["not-a-catalog-field"],
        },
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.error, "invalid_body");
      assert.equal(response.body.code, "INTEGRATION_EVENT_POLICY_FIELD_NOT_ALLOWED");
    });

    it("rejects undeclared eventType with 400 invalid_body", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/NotARealEvent`,
        tenantId,
        body: {
          enabled: true,
          selectedFieldIds: ["title"],
        },
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.error, "invalid_body");
      assert.equal(response.body.code, "INTEGRATION_DELIVERY_INTENT_EVENT_NOT_ALLOWED");
    });

    it("rejects template referencing field outside selection with 400 invalid_body", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourPublished`,
        tenantId,
        body: {
          enabled: true,
          selectedFieldIds: ["title"],
          templateId: "Tour {{field:denali.datetime}}",
        },
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.error, "invalid_body");
      assert.equal(response.body.code, "INTEGRATION_EVENT_POLICY_TEMPLATE_FIELD_NOT_ALLOWED");
    });

    it("rejects invalid enabled type with 400 invalid_body", async () => {
      const response = await requestJson(listener, {
        method: "PATCH",
        path: `/integrations/${connectionId}/exposure-intents/TourPublished`,
        tenantId,
        body: {
          enabled: "yes",
          selectedFieldIds: ["title"],
        },
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.error, "invalid_body");
      assert.equal(response.body.code, "INTEGRATION_DELIVERY_INTENT_ENABLED_INVALID");
    });
  },
);
