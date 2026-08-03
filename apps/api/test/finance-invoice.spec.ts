/**
 * Phase 9.7 R2 — registration invoice read model (CP-9.7-11).
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
import { resetFinanceScheduleStoreForTests } from "../src/workspace-finance/finance-schedule-store";
import { disconnectPrisma } from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "finance-invoice-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-finance-invoice",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly body?: unknown;
    readonly idempotencyKey?: string;
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
            ...(input.idempotencyKey !== undefined
              ? { "Idempotency-Key": input.idempotencyKey }
              : {}),
            ...authHeaders(input.tenantId),
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

describe("finance-invoice.spec.ts — Phase 9.7 R2", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  let admin: PrismaClient;
  const listener = createRequestListener();

  before(async () => {
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    resetFinanceScheduleStoreForTests();
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.tenant.create({
      data: {
        id: denaliTenantId,
        subdomain: `inv-${denaliTenantId.slice(0, 8)}`,
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
      await admin.paymentReceipt.deleteMany({ where: { tenantId: denaliTenantId } });
      await admin.payment.deleteMany({ where: { tenantId: denaliTenantId } });
      await admin.outboxEvent.deleteMany({ where: { tenantId: denaliTenantId } });
      await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId: denaliTenantId } });
      await admin.tenant.delete({ where: { id: denaliTenantId } });
    } finally {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
      );
    }
    await admin.$disconnect();
    await disconnectPrisma();
  });

  it("API-9.7-R2-INV-04 prepayment + paid payment produce correct balance", async () => {
    const registrationId = randomUUID();

    await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey: `inv-manual-${registrationId}`,
      body: {
        registrationId,
        amount: "10000000",
        currency: "IRR",
      },
    });

    await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey: `inv-prepay-${registrationId}`,
      body: {
        registrationId,
        amountMinor: "3000000",
        currency: "IRR",
        method: "Manual",
      },
    });

    const invoice = await requestJson(listener, {
      method: "GET",
      path: `/finance/invoices/${registrationId}`,
      tenantId: denaliTenantId,
    });
    assert.equal(invoice.status, 200);
    assert.equal(invoice.body.registrationId, registrationId);
    assert.equal(invoice.body.invoiceTotalMinor, "10000000");
    assert.equal(invoice.body.walletNetMinor, "3000000");
    assert.equal(invoice.body.paidAmountMinor, "3000000");
    assert.equal(invoice.body.balanceDueMinor, "7000000");
  });
});
