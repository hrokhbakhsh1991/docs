/**
 * Phase 9 foundation — identity + bookings + settings persist on Postgres when STORAGE_DRIVER=prisma.
 * Requires: DATABASE_URL + migrations through 20260609130000_operator_otp_code_hash.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetBookingsRepositorySingletonForTests } from "../src/bookings/create-bookings-repository";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { resetIdentityRepositorySingletonForTests } from "../src/identity/create-identity-repository";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { disconnectPrisma, getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { resetSettingsConfigRepositorySingletonForTests } from "../src/settings/create-settings-config-repository";
import { getSettingsConfigRepository } from "../src/settings/create-settings-config-repository";
import { hashOtpCode } from "../src/identity/otp-code";
import { isPhoneAuthorizedForTenantLogin } from "../src/identity/phone-login-authorization";
import { resetSettingsResourcesRepositorySingletonForTests } from "../src/settings/create-settings-resources-repository";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import { createTestToursService } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

async function httpJson(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "POST",
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
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
      const payload = options?.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            ...options?.headers,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
            });
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

function persistenceAuthHeaders(tenantId: string, userId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-p9-persist",
  };
}

describe("Phase 9 persistence (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const priorDriver = process.env.STORAGE_DRIVER;

  before(async () => {
    process.env.STORAGE_DRIVER = "prisma";
    resetIdentityRepositorySingletonForTests();
    resetBookingsRepositorySingletonForTests();
    resetSettingsConfigRepositorySingletonForTests();
    resetSettingsResourcesRepositorySingletonForTests();

    const prisma = getPrisma();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        subdomain: `p9-persist-${tenantId.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
    });
    await prisma.user.create({
      data: { id: userId, mobile: `+1555${tenantId.replace(/\D/g, "").slice(0, 7)}` },
    });
    await withTenantRls(tenantId, (tx) =>
      tx.userTenant.create({
        data: {
          userId,
          tenantId,
          role: "owner",
          status: "ACTIVE",
          sessionVersion: 1,
        },
      })
    );
  });

  after(async () => {
    const prisma = getPrisma();
    await withTenantRls(tenantId, async (tx) => {
      await tx.operatorRegistration.deleteMany({ where: { tenantId } });
      await tx.tenantConfig.deleteMany({ where: { tenantId } });
      await tx.workspaceEquipment.deleteMany({ where: { tenantId } });
      await tx.operatorSettingsAuditEvent.deleteMany({ where: { tenantId } });
      await tx.userTenant.deleteMany({ where: { tenantId } });
    });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    resetIdentityRepositorySingletonForTests();
    resetBookingsRepositorySingletonForTests();
    resetSettingsConfigRepositorySingletonForTests();
    resetSettingsResourcesRepositorySingletonForTests();
    if (priorDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorDriver;
    }
    await disconnectPrisma();
  });

  it("P9-PERSIST-01 identity membership round-trips via Prisma repository", async () => {
    const identity = getIdentityRepository();
    const membership = await identity.findMembership(userId, tenantId);
    assert.ok(membership !== null);
    assert.equal(membership.role, "owner");
    assert.equal(membership.status, "ACTIVE");
  });

  it("P9-PERSIST-02 booking create survives repository re-read", async () => {
    const bookings = getBookingsRepository();
    const departureAt = new Date();
    departureAt.setUTCDate(departureAt.getUTCDate() + 3);
    const created = await bookings.createBooking({
      tenantId,
      submittedByUserId: userId,
      body: {
        tourId: randomUUID(),
        tourTitle: "Integration Trek",
        guestLabel: "Guest One",
        partySize: 2,
        departureAt: departureAt.toISOString(),
      },
    });
    const listed = await bookings.listByTenant(tenantId);
    assert.ok(listed.some((row) => row.id === created.id));
  });

  it("P9-PERSIST-03 tenant config and equipment persist under RLS", async () => {
    const configRepo = getSettingsConfigRepository();
    const resourcesRepo = getSettingsResourcesRepository();

    await configRepo.put(tenantId, "wizard_template", {
      configVersion: 1,
      payload: {
        seedLabel: "persist-test",
        sections: [{ id: "basics", label: "Basics", enabled: true }],
      },
    });
    const storedConfig = await configRepo.get(tenantId, "wizard_template");
    assert.ok(storedConfig !== null);
    assert.equal(storedConfig.payload.seedLabel, "persist-test");

    const equipment = await resourcesRepo.createEquipment(tenantId, {
      name: "Persist Pack",
      category: "gear",
    });
    const listed = await resourcesRepo.listEquipment(tenantId);
    assert.ok(listed.some((row) => row.id === equipment.id));
  });

  it("P9-PERSIST-04 OTP challenge code_hash round-trips via Prisma repository", async () => {
    const identity = getIdentityRepository();
    const codeHash = await hashOtpCode("882211");
    const mobile = `+1555${tenantId.replace(/\D/g, "").slice(0, 7)}9`;
    const { challengeId } = await identity.createOtpChallenge(mobile, codeHash);
    const row = await identity.findOtpChallenge(challengeId);
    assert.ok(row !== null);
    assert.equal(row.codeHash, codeHash);
    assert.equal(row.used, false);
  });

  it("P9-PERSIST-05 profile displayName persists in membership_metadata", async () => {
    const identity = getIdentityRepository();
    await identity.updateMembershipDisplayName(tenantId, userId, "Persist Profile");
    const membership = await identity.findMembership(userId, tenantId);
    assert.ok(membership !== null);
    assert.equal(membership.displayName, "Persist Profile");
  });

  it("P9-PERSIST-06 Prisma identity authorizes seeded owner mobile for login gate", async () => {
    const identity = getIdentityRepository();
    const membership = await identity.findMembership(userId, tenantId);
    assert.ok(membership !== null);

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.ok(user !== null);

    const authorized = await isPhoneAuthorizedForTenantLogin(tenantId, user.mobile, identity);
    assert.equal(authorized, true);

    const unknown = await isPhoneAuthorizedForTenantLogin(tenantId, "+15559999999", identity);
    assert.equal(unknown, false);
  });

  it("P9-PERSIST-07 HTTP request-otp gate uses Prisma identity (403 unauthorized, 200 owner)", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.ok(user !== null);

    const listener = createRequestListener({ toursService: createTestToursService() });
    const headers = persistenceAuthHeaders(tenantId, userId);

    const denied = await httpJson(listener, "POST", "/auth/request-otp", {
      headers,
      body: { mobile: "+15559999999" },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "AUTH_PHONE_NOT_AUTHORIZED");

    const allowed = await httpJson(listener, "POST", "/auth/request-otp", {
      headers,
      body: { mobile: user.mobile },
    });
    assert.equal(allowed.status, 200);
    assert.equal(typeof allowed.body.challengeId, "string");
  });
});
