/**
 * Phase 9.7 R2 + Phase 3A — prepayment record/list + TX/idempotency (F-01 · F-02).
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
import { buildPrepaymentDomainEventIds } from "../src/workspace-finance/finance.service";
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

describe("finance-prepayments.spec.ts — Phase 9.7 R2 + 3A", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  const denaliTenantBId = integrationTenantId();
  let admin: PrismaClient;
  const listener = createRequestListener();
  const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;

  before(async () => {
    process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER?.trim() || "prisma";
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    resetHttpIdempotencyMemoryForTests();
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.tenant.create({
      data: {
        id: denaliTenantId,
        subdomain: `prepay-${denaliTenantId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
    await admin.tenant.create({
      data: {
        id: denaliTenantBId,
        subdomain: `prepayb-${denaliTenantBId.slice(0, 8)}`,
        workspaceType: "denali",
        theme: {},
      },
    });
  });

  beforeEach(() => {
    delete process.env.P5_ATOMIC_TX_TEST_ABORT;
    resetHttpIdempotencyMemoryForTests();
  });

  after(async () => {
    if (priorAbort === undefined) {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
    } else {
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
    }
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
    );
    try {
      await admin.httpIdempotencyRecord.deleteMany({
        where: { tenantId: { in: [denaliTenantId, denaliTenantBId] } },
      });
      await admin.outboxEvent.deleteMany({
        where: { tenantId: { in: [denaliTenantId, denaliTenantBId] } },
      });
      await admin.tenant.deleteMany({
        where: { id: { in: [denaliTenantId, denaliTenantBId] } },
      });
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
      idempotencyKey: `r2-01-${registrationId}`,
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
      idempotencyKey: `r2-02-${registrationId}`,
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
      idempotencyKey: `r2-03-${registrationId}`,
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
      idempotencyKey: `r2-04-${randomUUID()}`,
      body: {
        registrationId: randomUUID(),
        amountMinor: "500000",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(response.status, 403);
  });

  it("API-9.7-R2-05 missing Idempotency-Key returns 400", async () => {
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      body: {
        registrationId: randomUUID(),
        amountMinor: "100",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(response.status, 400);
  });

  it("PREPAY-IDEM-01 same key retry → one finance.prepayment.recorded", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `idem-01-${registrationId}`;
    const body = {
      registrationId,
      amountMinor: "2500000",
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
    const second = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(second.status, 201);
    assert.equal(second.body.id, first.body.id);

    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const count = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.recorded",
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    assert.equal(count, 1);
  });

  it("PREPAY-IDEM-02 same key → one ledger business identity", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `idem-02-${registrationId}`;
    const body = {
      registrationId,
      amountMinor: "1100000",
      currency: "IRR",
      method: "Manual",
    };
    await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const count = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.ledger.double_entry_applied",
        domainEventId: ids.ledgerDomainEventId,
      },
    });
    assert.equal(count, 1);
  });

  it("PREPAY-IDEM-03 different keys same amount → two logical prepayments", async () => {
    const registrationId = randomUUID();
    const body = {
      registrationId,
      amountMinor: "2500000",
      currency: "IRR",
      method: "Manual",
    };
    const a = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey: `idem-03a-${registrationId}`,
      body,
    });
    const b = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey: `idem-03b-${registrationId}`,
      body,
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.id, b.body.id);

    const idsA = buildPrepaymentDomainEventIds(registrationId, `idem-03a-${registrationId}`);
    const idsB = buildPrepaymentDomainEventIds(registrationId, `idem-03b-${registrationId}`);
    assert.notEqual(idsA.prepaymentDomainEventId, idsB.prepaymentDomainEventId);
    assert.notEqual(idsA.ledgerDomainEventId, idsB.ledgerDomainEventId);

    const prepayCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.recorded",
        domainEventId: {
          in: [idsA.prepaymentDomainEventId, idsB.prepaymentDomainEventId],
        },
      },
    });
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.ledger.double_entry_applied",
        domainEventId: { in: [idsA.ledgerDomainEventId, idsB.ledgerDomainEventId] },
      },
    });
    assert.equal(prepayCount, 2);
    assert.equal(ledgerCount, 2);
  });

  it("PREPAY-IDEM-04 same key different tenants → no collision", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `idem-04-shared-${registrationId}`;
    const body = {
      registrationId,
      amountMinor: "900000",
      currency: "IRR",
      method: "Manual",
    };
    const a = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    const b = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantBId,
      idempotencyKey,
      body,
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.id, b.body.id);

    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const countA = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    const countB = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantBId,
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    assert.equal(countA, 1);
    assert.equal(countB, 1);
  });

  it("PREPAY-TX-01 abort before ledger → zero durable events", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `tx-01-${registrationId}`;
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_prepayment_before_commit";
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: {
        registrationId,
        amountMinor: "100",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.notEqual(response.status, 201);
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const prepay = await admin.outboxEvent.count({
      where: { tenantId: denaliTenantId, domainEventId: ids.prepaymentDomainEventId },
    });
    const ledger = await admin.outboxEvent.count({
      where: { tenantId: denaliTenantId, domainEventId: ids.ledgerDomainEventId },
    });
    assert.equal(prepay, 0);
    assert.equal(ledger, 0);
  });

  it("PREPAY-TX-02 abort after ledger write → zero durable events", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `tx-02-${registrationId}`;
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_prepayment_after_ledger";
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: {
        registrationId,
        amountMinor: "200",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.notEqual(response.status, 201);
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const prepay = await admin.outboxEvent.count({
      where: { tenantId: denaliTenantId, domainEventId: ids.prepaymentDomainEventId },
    });
    const ledger = await admin.outboxEvent.count({
      where: { tenantId: denaliTenantId, domainEventId: ids.ledgerDomainEventId },
    });
    assert.equal(prepay, 0);
    assert.equal(ledger, 0);
  });

  it("PREPAY-BOOK-01 booking sync miss → prepayment remains durable", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `book-01-${registrationId}`;
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: {
        registrationId,
        amountMinor: "333000",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(response.status, 201);
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const count = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.recorded",
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    assert.equal(count, 1);
    const list = await requestJson(listener, {
      method: "GET",
      path: `/finance/prepayments?limit=50`,
      tenantId: denaliTenantId,
    });
    const items = list.body.items as unknown[];
    assert.ok(
      items.some(
        (row) =>
          typeof row === "object" &&
          row !== null &&
          (row as Record<string, unknown>).registrationId === registrationId
      )
    );
  });

  it("PREPAY-CONC-01 concurrent same key → one logical prepayment", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `conc-01-${registrationId}`;
    const body = {
      registrationId,
      amountMinor: "444000",
      currency: "IRR",
      method: "Manual",
    };
    const [a, b] = await Promise.all([
      requestJson(listener, {
        method: "POST",
        path: "/finance/prepayments",
        tenantId: denaliTenantId,
        idempotencyKey,
        body,
      }),
      requestJson(listener, {
        method: "POST",
        path: "/finance/prepayments",
        tenantId: denaliTenantId,
        idempotencyKey,
        body,
      }),
    ]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(a.body.id, b.body.id);
    const ids = buildPrepaymentDomainEventIds(registrationId, idempotencyKey);
    const prepay = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.recorded",
        domainEventId: ids.prepaymentDomainEventId,
      },
    });
    const ledger = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.ledger.double_entry_applied",
        domainEventId: ids.ledgerDomainEventId,
      },
    });
    assert.equal(prepay, 1);
    assert.equal(ledger, 1);
  });

  it("PREPAY-SYNC-DEG-01 booking miss → durable degraded outbox", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `sync-deg-01-${registrationId}`;
    const recorded = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: {
        registrationId,
        amountMinor: "111000",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(recorded.status, 201);
    const degraded = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.prepayment.booking_sync.degraded",
        aggregateId: registrationId,
      },
    });
    assert.equal(degraded, 1);
    const listed = await requestJson(listener, {
      method: "GET",
      path: "/finance/prepayments/booking-sync-degraded",
      tenantId: denaliTenantId,
    });
    assert.equal(listed.status, 200);
    const items = listed.body.items as Array<{ registrationId: string }>;
    assert.ok(items.some((row) => row.registrationId === registrationId));
  });

  it("PREPAY-SYNC-RETRY-01 retry after booking exists → partial + recovered", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `sync-retry-01-${registrationId}`;
    const recorded = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: {
        registrationId,
        amountMinor: "222000",
        currency: "IRR",
        method: "Manual",
      },
    });
    assert.equal(recorded.status, 201);

    await admin.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${denaliTenantId}::text, true)
      `;
      await tx.operatorRegistration.create({
        data: {
          id: registrationId,
          tenantId: denaliTenantId,
          tourId: randomUUID(),
          tourTitle: "Prepay Sync Retry Tour",
          guestLabel: "Guest",
          partySize: 1,
          status: "pending",
          paymentStatus: "unpaid",
          departureAt: new Date("2026-08-01T00:00:00.000Z"),
          submittedByUserId: randomUUID(),
        },
      });
    });

    const retry = await requestJson(listener, {
      method: "POST",
      path: "/finance/prepayments/booking-sync-retry",
      tenantId: denaliTenantId,
      body: { registrationId },
    });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.paymentStatus, "partial");
    assert.equal(retry.body.recovered, true);

    const booking = await admin.operatorRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentStatus: true },
    });
    assert.equal(booking?.paymentStatus, "partial");

    const listed = await requestJson(listener, {
      method: "GET",
      path: "/finance/prepayments/booking-sync-degraded",
      tenantId: denaliTenantId,
    });
    assert.equal(listed.status, 200);
    const items = listed.body.items as Array<{ registrationId: string }>;
    assert.ok(!items.some((row) => row.registrationId === registrationId));
  });
});
