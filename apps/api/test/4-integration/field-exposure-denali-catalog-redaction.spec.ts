/**
 * 4-integration — Denali public catalog redaction via workspace surface exposure (Phase 10.3).
 *
 * Run:
 *   DATABASE_URL='postgresql://...' STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api run test:exposure:integration
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { forceIntegrationSubsystemReadyForTests } from "../../src/health/integration-subsystem-gate";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

function adminHeaders(tenantId: string, userId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "denali",
  };
}

function publicHeaders(tenantId: string): Record<string, string> {
  return { "x-tenant-id": tenantId };
}

function buildPublishedDenaliCanonical(title: string): {
  readonly schemaVersion: number;
  readonly roots: string[];
  readonly data: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    title,
    publishStatus: "active",
    startDateTime: "2026-07-01T08:00:00.000Z",
    endDateTime: "2026-07-03T18:00:00.000Z",
    category: "mountain_multi",
    capacityMax: 12,
    program: { shortDescription: "Catalog redaction integration tour" },
  };
  return {
    schemaVersion: 1,
    roots: Object.keys(data).sort(),
    data,
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly headers: Record<string, string>;
    readonly body?: unknown;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("field-exposure-denali-catalog-redaction: no listen address"));
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
            ...input.headers,
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
  "4-integration — Denali catalog exposure redaction",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for catalog redaction",
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    const tourId = randomUUID();
    const actorUserId = "field-exposure-catalog-redaction-admin";
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
          subdomain: `exposure-catalog-${runId}`,
          workspaceType: "denali",
        },
      });

      await admin.tour.create({
        data: {
          id: tourId,
          tenantId,
          canonical: buildPublishedDenaliCanonical("Exposure Catalog Redaction Tour"),
        },
      });

      listener = createRequestListener();
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      await admin.exposureIntent.deleteMany({ where: { tenantId } });
      await admin.tour.deleteMany({ where: { id: tourId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("returns full datetime fields before surface exposure override", async () => {
      const response = await requestJson(listener, {
        method: "GET",
        path: `/denali/catalog/${tourId}`,
        headers: publicHeaders(tenantId),
      });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      const data = response.body.data as Record<string, unknown>;
      assert.equal(data.title, "Exposure Catalog Redaction Tour");
      assert.equal(data.departureAt, "2026-07-01T08:00:00.000Z");
      assert.equal(data.endAt, "2026-07-03T18:00:00.000Z");
    });

    it("redacts hidden catalog fields after public_list surface override", async () => {
      const patch = await requestJson(listener, {
        method: "PATCH",
        path: "/workspaces/denali/exposure/surfaces/public_list",
        headers: adminHeaders(tenantId, actorUserId),
        body: {
          enabled: true,
          selectedFieldIds: ["title"],
          audience: "public",
          trigger: "always",
        },
      });
      assert.equal(patch.status, 200, JSON.stringify(patch.body));

      const response = await requestJson(listener, {
        method: "GET",
        path: `/denali/catalog/${tourId}`,
        headers: publicHeaders(tenantId),
      });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      const data = response.body.data as Record<string, unknown>;
      assert.equal(data.title, "Exposure Catalog Redaction Tour");
      assert.equal(data.departureAt, null);
      assert.equal(data.endAt, null);
      assert.equal(data.totalCapacity, null);
    });
  },
);
