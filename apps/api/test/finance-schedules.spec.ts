/**
 * Phase 9.7 R3 — payment schedule generate + list (CP-9.7-12 · CP-9.7-13 · CP-9.7-14).
 * Authority: docs/phase-9/appendices/FINANCE-OPS-UX.md §5.4
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../src/boot/lazy-workspace-finance-handlers";
import { resetFinanceScheduleStoreForTests } from "../src/denali-finance/finance-schedule-store";
import { disconnectPrisma } from "../src/db/prisma";
import { installHttpTestClient } from "./http-test-client";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

function financeAuthHeaders(
  tenantId: string,
  role: "admin" | "owner" | "member" = "owner"
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "finance-schedule-user",
    "x-actor-role": role,
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-finance-schedule",
  };
}

function scheduleTemplate(invoiceTotalMinor: string) {
  return {
    depositPercent: 30,
    installmentCount: 2,
    graceDays: 7,
    firstDueAt: "2026-07-01T00:00:00.000Z",
    invoiceTotalMinor,
    currency: "IRR",
  };
}

describe("finance-schedules.spec.ts — Phase 9.7 R3", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  let admin: PrismaClient;
  const client = installHttpTestClient(() => createRequestListener());

  before(async () => {
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    resetFinanceScheduleStoreForTests();
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.tenant.create({
      data: {
        id: denaliTenantId,
        subdomain: `sched-${denaliTenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
  });

  after(async () => {
    resetFinanceScheduleStoreForTests();
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
    );
    try {
      await admin.outboxEvent.deleteMany({ where: { tenantId: denaliTenantId } });
      await admin.tenant.delete({ where: { id: denaliTenantId } });
    } finally {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
      );
    }
    await admin.$disconnect();
    await disconnectPrisma();
  });

  it("API-9.7-R3-01 POST /finance/schedules/generate returns 201 (CP-9.7-12)", async () => {
    const registrationId = randomUUID();
    const response = await client.requestJson("POST", "/finance/schedules/generate", {
      headers: financeAuthHeaders(denaliTenantId),
      body: {
        registrationId,
        template: scheduleTemplate("10000000"),
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.registrationId, registrationId);
    const items = response.body.items as unknown[];
    assert.ok(Array.isArray(items));
    assert.equal(items.length, 3);
  });

  it("API-9.7-R3-02 schedule item amounts sum to invoice total (CP-9.7-14)", async () => {
    const registrationId = randomUUID();
    const invoiceTotalMinor = "10000000";
    const response = await client.requestJson("POST", "/finance/schedules/generate", {
      headers: financeAuthHeaders(denaliTenantId),
      body: {
        registrationId,
        template: scheduleTemplate(invoiceTotalMinor),
      },
    });
    assert.equal(response.status, 201);
    const items = response.body.items as Array<{ amountMinor: string }>;
    const sum = items.reduce((acc, row) => acc + BigInt(row.amountMinor), BigInt(0));
    assert.equal(sum, BigInt(invoiceTotalMinor));
    assert.equal(items[0]?.amountMinor, "3000000");
    assert.equal(String(items[0]?.label ?? ""), "Prepayment");
  });

  it("API-9.7-R3-03 GET /finance/schedules lists tenant schedules (CP-9.7-13)", async () => {
    const registrationId = randomUUID();
    await client.requestJson("POST", "/finance/schedules/generate", {
      headers: financeAuthHeaders(denaliTenantId),
      body: {
        registrationId,
        template: scheduleTemplate("5000000"),
      },
    });

    const list = await client.requestJson("GET", "/finance/schedules", {
      headers: financeAuthHeaders(denaliTenantId),
    });
    assert.equal(list.status, 200);
    const items = list.body.items as unknown[];
    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 3);
    const match = items.filter(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        (row as Record<string, unknown>).registrationId === registrationId
    );
    assert.equal(match.length, 3);
  });

  it("API-9.7-R3-04 member cannot generate schedule", async () => {
    const response = await client.requestJson("POST", "/finance/schedules/generate", {
      headers: financeAuthHeaders(denaliTenantId, "member"),
      body: {
        registrationId: randomUUID(),
        template: scheduleTemplate("1000000"),
      },
    });
    assert.equal(response.status, 403);
  });
});
