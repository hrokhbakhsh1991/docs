/**
 * Phase 4B H0.1 — stale HttpIdempotencyRecord processing reclaim.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../src/boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../src/db/prisma";
import { resetHttpIdempotencyMemoryForTests } from "../src/http/http-idempotency";
import {
  reclaimStaleProcessingHttpIdempotencyRecords,
  resolveHttpIdempotencyProcessingReclaimMs,
} from "../src/http/http-idempotency-reclaim";
import { buildPrepaymentDomainEventIds } from "../src/workspace-finance/finance.service";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "finance-idem-reclaim-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-finance-idem-reclaim",
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

describe("http-idempotency-reclaim.spec.ts — Phase 4B H0.1", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  let admin: PrismaClient;
  const listener = createRequestListener();
  const priorReclaimMs = process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS;
  const reclaimMs = 50;

  before(async () => {
    process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER?.trim() || "prisma";
    process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS = String(reclaimMs);
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    resetHttpIdempotencyMemoryForTests();
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.tenant.create({
      data: {
        id: denaliTenantId,
        subdomain: `idemrc-${denaliTenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
  });

  beforeEach(() => {
    process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS = String(reclaimMs);
    resetHttpIdempotencyMemoryForTests();
  });

  after(async () => {
    if (priorReclaimMs === undefined) {
      delete process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS;
    } else {
      process.env.HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS = priorReclaimMs;
    }
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
    );
    await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId: denaliTenantId } });
    await admin.outboxEvent.deleteMany({ where: { tenantId: denaliTenantId } });
    await admin.paymentReceipt.deleteMany({ where: { tenantId: denaliTenantId } });
    await admin.payment.deleteMany({ where: { tenantId: denaliTenantId } });
    await admin.operatorRegistration.deleteMany({ where: { tenantId: denaliTenantId } });
    await admin.tenant.deleteMany({ where: { id: denaliTenantId } });
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
    );
    await admin.$disconnect();
    await disconnectPrisma();
  });

  it("IDEM-RECLAIM-01 stale processing row is deleted", async () => {
    assert.equal(resolveHttpIdempotencyProcessingReclaimMs(), reclaimMs);
    const idempotencyKey = `reclaim-01-${randomUUID()}`;
    const staleAt = new Date(Date.now() - reclaimMs - 5_000);
    await admin.httpIdempotencyRecord.create({
      data: {
        tenantId: denaliTenantId,
        idempotencyKey,
        requestHash: "hash-reclaim-01",
        status: "processing",
        createdAt: staleAt,
      },
    });

    const reclaimed = await reclaimStaleProcessingHttpIdempotencyRecords(reclaimMs);
    assert.ok(reclaimed >= 1);
    const row = await admin.httpIdempotencyRecord.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId: denaliTenantId, idempotencyKey },
      },
    });
    assert.equal(row, null);
  });

  it("IDEM-RECLAIM-02 prepay stuck processing → reclaim → same key retry (one logical)", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `reclaim-02-${registrationId}`;
    const body = {
      registrationId,
      amountMinor: "100000",
      currency: "IRR",
      method: "Manual",
    };
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(first.status, 201);

    await admin.httpIdempotencyRecord.update({
      where: {
        tenantId_idempotencyKey: { tenantId: denaliTenantId, idempotencyKey },
      },
      data: {
        status: "processing",
        responseBody: null,
        statusCode: null,
        completedAt: null,
        createdAt: new Date(Date.now() - reclaimMs - 5_000),
      },
    });

    const reclaimed = await reclaimStaleProcessingHttpIdempotencyRecords(reclaimMs);
    assert.ok(reclaimed >= 1);

    const retry = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(retry.status, 201);
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const prepay = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.recorded",
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    assert.equal(prepay, 1);
  });

  it("IDEM-RECLAIM-03 processing-only (no business) → reclaim → retry creates one", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `reclaim-03-${registrationId}`;
    await admin.httpIdempotencyRecord.create({
      data: {
        tenantId: denaliTenantId,
        idempotencyKey,
        requestHash: "will-mismatch-or-reclaim",
        status: "processing",
        createdAt: new Date(Date.now() - reclaimMs - 5_000),
      },
    });
    await reclaimStaleProcessingHttpIdempotencyRecords(reclaimMs);

    const created = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: {
        registrationId,
        amountMinor: "200000",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(created.status, 201);
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const prepay = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.recorded",
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    assert.equal(prepay, 1);
  });

  it("IDEM-RECLAIM-04 approve stuck processing → reclaim → same key retry (one ledger)", async () => {
    const registrationId = randomUUID();
    await admin.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${denaliTenantId}::text, true)
      `;
      await tx.operatorRegistration.create({
        data: {
          id: registrationId,
          tenantId: denaliTenantId,
          tourId: randomUUID(),
          tourTitle: "Idem Reclaim Tour",
          guestLabel: "Guest",
          partySize: 1,
          status: "pending",
          paymentStatus: "unpaid",
          departureAt: new Date("2026-08-01T00:00:00.000Z"),
          submittedByUserId: randomUUID(),
        },
      });
    });

    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      body: { registrationId, amount: "5000000", currency: "IRR" },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const receipt = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      body: { paymentId, fileKey: `receipts/${paymentId}/proof.jpg` },
    });
    assert.equal(receipt.status, 201);
    const receiptId = String(receipt.body.id);
    const idempotencyKey = `reclaim-04-${receiptId}`;

    const approve = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { decision: "approve" },
    });
    assert.equal(approve.status, 200);

    await admin.httpIdempotencyRecord.update({
      where: {
        tenantId_idempotencyKey: { tenantId: denaliTenantId, idempotencyKey },
      },
      data: {
        status: "processing",
        responseBody: null,
        statusCode: null,
        completedAt: null,
        createdAt: new Date(Date.now() - reclaimMs - 5_000),
      },
    });
    await reclaimStaleProcessingHttpIdempotencyRecords(reclaimMs);

    const retry = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { decision: "approve" },
    });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.status, "Approved");

    const ledger = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.ledger.double_entry_applied",
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledger, 1);
  });
});
