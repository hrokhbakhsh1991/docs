/**
 * Phase 9.7 R2 — prepayment record + list (REQ-P9-073 · CP-9.7-10).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../src/boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

function authHeaders(
  tenantId: string,
  role: "admin" | "owner" | "member" = "admin"
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "finance-prepay-user",
    "x-actor-role": role,
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-finance-prepay",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly body?: unknown;
    readonly role?: "admin" | "owner" | "member";
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
            ...authHeaders(input.tenantId, input.role),
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
        }
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

describe("finance-prepayments.spec.ts — Phase 9.7 R2", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  let admin: PrismaClient;
  const listener = createRequestListener();

  before(async () => {
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.tenant.create({
      data: {
        id: denaliTenantId,
        subdomain: `prepay-${denaliTenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
  });

  after(async () => {
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

  it("API-9.7-R2-01 record prepayment returns 201", async () => {
    const registrationId = randomUUID();
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      body: {
        registrationId,
        amountMinor: "2500000",
        currency: "IRR",
        method: "Manual",
        note: "deposit at registration",
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.registrationId, registrationId);
    assert.equal(response.body.amountMinor, "2500000");
    assert.equal(response.body.currency, "IRR");
    assert.ok(typeof response.body.id === "string");
  });

  it("API-9.7-R2-02 list prepayments includes recorded row", async () => {
    const registrationId = randomUUID();
    await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      body: {
        registrationId,
        amountMinor: "1000000",
        currency: "IRR",
        method: "BankTransfer",
      },
    });

    const list = await requestJson(listener, {
      method: "GET",
      path: "/finance/prepayments?limit=10",
      tenantId: denaliTenantId,
    });
    assert.equal(list.status, 200);
    const items = list.body.items as unknown[];
    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 1);
    const match = items.find(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        (row as Record<string, unknown>).registrationId === registrationId
    ) as Record<string, unknown> | undefined;
    assert.ok(match);
    assert.equal(match.amountMinor, "1000000");
  });

  it("API-9.7-R2-03 prepayment emits ledger double-entry outbox", async () => {
    const registrationId = randomUUID();
    await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      body: {
        registrationId,
        amountMinor: "750000",
        currency: "IRR",
        method: "Manual",
      },
    });

    const ledger = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/ledger-events?limit=20",
      tenantId: denaliTenantId,
    });
    assert.equal(ledger.status, 200);
    const items = ledger.body.items as unknown[];
    assert.ok(Array.isArray(items));
    const prepayEvent = items.find((row) => {
      if (typeof row !== "object" || row === null) {
        return false;
      }
      const record = row as Record<string, unknown>;
      return (
        record.eventType === "finance.ledger.double_entry_applied" &&
        record.registrationId === registrationId
      );
    });
    assert.ok(prepayEvent, "expected finance.ledger.double_entry_applied for registration");
  });

  it("API-9.7-R2-04 member cannot record prepayment", async () => {
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      role: "member",
      body: {
        registrationId: randomUUID(),
        amountMinor: "500000",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(response.status, 403);
  });
});
