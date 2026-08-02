/**
 * TODO-001 / PREV-AUD-001 — honest production JWT → HTTP → Prisma booking write.
 *
 * Forbidden: x-* header auth, memory SoT, silent skip without DATABASE_URL reason.
 * Missing DATABASE_URL(+ADMIN) → honest describe skip (visible `*_REQUIRES_DATABASE` reason).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import {
  getBookingsRepository,
  resetBookingsRepositorySingletonForTests,
} from "../src/bookings/create-bookings-repository";
import { resetBookingsServiceCompositionForTests } from "../src/bookings/create-bookings-service";
import { PrismaBookingsRepository } from "../src/bookings/prisma-bookings.repository";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { disconnectPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { integrationTenantId } from "./test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = hasDatabase
  ? false
  : "BOOKING_HTTP_POSTGRES_JWT_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN (TODO-001)";

const ENV_KEYS = [
  "NODE_ENV",
  "STORAGE_DRIVER",
  "AUTH_JWT_PUBLIC_KEY",
  "AUTH_JWT_PRIVATE_KEY",
  "AUTH_JWT_ISSUER",
  "AUTH_JWT_AUDIENCE",
  "AUTH_ALLOW_DEV_BEARER",
  "APPS_API_PRODUCTION_AUTH_HARNESS",
  "OUTBOX_RELAY_ENABLED",
  "TENANT_RATE_LIMIT_ENABLED",
  "OTP_FIXTURE_CODE",
  "AUTH_ALLOW_DEV_STATIC_OTP",
] as const;

const envSnapshot: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
  envSnapshot[key] = process.env[key];
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = envSnapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetSessionTokenKeyCacheForTests();
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly headers: Record<string, string>;
    readonly body?: unknown;
  }
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
            ...input.headers,
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
              try {
                body = JSON.parse(text) as Record<string, unknown>;
              } catch {
                body = { raw: text };
              }
            }
            resolve({ status: res.statusCode ?? 0, body });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

describe(
  "bookings-http-postgres-jwt-production — TODO-001 production JWT path",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantId = integrationTenantId();
    const userId = randomUUID();
    const tourId = randomUUID();
    const workspaceId = "ws-jwt-prod-cert";
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let privateKey: CryptoKey;
    let publicPem: string;
    let privatePem: string;

    before(async () => {
      const pair = await generateKeyPair("RS256", { extractable: true });
      privateKey = pair.privateKey;
      publicPem = await exportSPKI(pair.publicKey);
      privatePem = await exportPKCS8(pair.privateKey);

      process.env.NODE_ENV = "production";
      process.env.STORAGE_DRIVER = "prisma";
      process.env.AUTH_JWT_PUBLIC_KEY = publicPem;
      process.env.AUTH_JWT_PRIVATE_KEY = privatePem;
      process.env.AUTH_JWT_ISSUER = "tour-ops";
      process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
      process.env.OUTBOX_RELAY_ENABLED = "true";
      process.env.TENANT_RATE_LIMIT_ENABLED = "false";
      delete process.env.AUTH_ALLOW_DEV_BEARER;
      delete process.env.APPS_API_PRODUCTION_AUTH_HARNESS;
      delete process.env.OTP_FIXTURE_CODE;
      delete process.env.AUTH_ALLOW_DEV_STATIC_OTP;
      resetSessionTokenKeyCacheForTests();

      resetLazyRouteHandlersForTests();
      resetLazyFinanceServiceForTests();
      resetBookingsRepositorySingletonForTests();
      resetBookingsServiceCompositionForTests();

      admin = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL_ADMIN!.trim() } },
      });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `jwt-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.user.create({
        data: { id: userId, mobile: `+1555${tenantId.replace(/\D/g, "").slice(0, 10)}` },
      });
      await withTenantRls(tenantId, (tx) =>
        tx.userTenant.create({
          data: {
            userId,
            tenantId,
            role: "admin",
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId,
          },
        })
      );

      const repo = getBookingsRepository();
      assert.ok(repo instanceof PrismaBookingsRepository);
      listener = createRequestListener();
    });

    after(async () => {
      try {
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId } });
        await admin.userTenant.deleteMany({ where: { tenantId } });
        await admin.user.deleteMany({ where: { id: userId } });
        await admin.tenant.deleteMany({ where: { id: tenantId } });
      } finally {
        await admin.$disconnect();
        await disconnectPrisma();
        restoreEnv();
        resetBookingsRepositorySingletonForTests();
        resetBookingsServiceCompositionForTests();
      }
    });

    async function signJwt(sessVer: number): Promise<string> {
      return new SignJWT({
        tenant_id: tenantId,
        role: "admin",
        sess_ver: String(sessVer),
        workspace_id: workspaceId,
        membership_status: "ACTIVE",
      })
        .setProtectedHeader({ alg: "RS256" })
        .setSubject(userId)
        .setIssuer("tour-ops")
        .setAudience("tour-ops-api")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);
    }

    function createBody(guestLabel: string): Record<string, unknown> {
      return {
        tourId,
        tourTitle: "JWT Prod Cert Tour",
        guestLabel,
        partySize: 1,
        departureAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        registrationIntake: { tourCapacityMax: 20 },
      };
    }

    it("JWT-only POST /bookings → 201 Prisma row", async () => {
      const token = await signJwt(1);
      const response = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        headers: { Authorization: `Bearer ${token}` },
        body: createBody(`JWT Guest ${randomUUID().slice(0, 8)}`),
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(typeof response.body.id, "string");
      const row = await admin.operatorRegistration.findUnique({
        where: { id: response.body.id as string },
      });
      assert.ok(row);
      assert.equal(row?.tenantId, tenantId);
    });

    it("header-only auth under NODE_ENV=production → 401", async () => {
      const response = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        headers: {
          "x-tenant-id": tenantId,
          "x-authenticated-tenant-id": tenantId,
          "x-user-id": userId,
          "x-actor-role": "admin",
          "x-membership-status": "ACTIVE",
          "x-workspace-id": workspaceId,
        },
        body: createBody("Header Forge"),
      });
      assert.ok(response.status === 401 || response.status === 403, JSON.stringify(response.body));
    });

    it("TODO-009 sess_ver mismatch after bump → 401 on create", async () => {
      await withTenantRls(tenantId, (tx) =>
        tx.userTenant.update({
          where: { userId_tenantId: { userId, tenantId } },
          data: { sessionVersion: 2 },
        })
      );
      const stale = await signJwt(1);
      const response = await requestJson(listener, {
        method: "POST",
        path: "/bookings",
        headers: { Authorization: `Bearer ${stale}` },
        body: createBody("Stale Sess"),
      });
      assert.equal(response.status, 401, JSON.stringify(response.body));
      await withTenantRls(tenantId, (tx) =>
        tx.userTenant.update({
          where: { userId_tenantId: { userId, tenantId } },
          data: { sessionVersion: 1 },
        })
      );
    });

    it("TODO-009 binary receipt on unknown booking fails before MinIO put", async () => {
      // Ownership/status check must reject before putMemberReceiptProof (MINIO_NOT_CONFIGURED).
      const token = await signJwt(1);
      const foreignBookingId = randomUUID();
      const body = Buffer.from("%PDF-1.4 foreign-receipt");
      const response = await new Promise<{ status: number; body: Record<string, unknown> }>(
        (resolve, reject) => {
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
                path: `/bookings/${foreignBookingId}/receipt`,
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/pdf",
                  "Content-Length": String(body.length),
                  "x-receipt-file-name": "foreign.pdf",
                },
              },
              (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk) => chunks.push(chunk as Buffer));
                res.on("end", () => {
                  server.close();
                  const text = Buffer.concat(chunks).toString("utf8");
                  let parsed: Record<string, unknown> = {};
                  if (text.length > 0) {
                    try {
                      parsed = JSON.parse(text) as Record<string, unknown>;
                    } catch {
                      parsed = { raw: text };
                    }
                  }
                  resolve({ status: res.statusCode ?? 0, body: parsed });
                });
              }
            );
            req.on("error", (error) => {
              server.close();
              reject(error);
            });
            req.write(body);
            req.end();
          });
        }
      );
      assert.ok(
        response.status === 403 || response.status === 404 || response.status === 400,
        JSON.stringify(response.body)
      );
      const blob = JSON.stringify(response.body);
      assert.doesNotMatch(blob, /MINIO_NOT_CONFIGURED/);
    });
  }
);
