/**
 * Phase 9.7 — finance operator API (REQ-P9-070 · REQ-P9-073 R1).
 *
 * Flow:
 *   GET /finance/reports/summary
 *   POST /finance/payments/manual
 *   POST /finance/receipts
 *   PATCH /finance/receipts/{id}/review (approve → ledger outbox)
 *
 * Requires Postgres (`DATABASE_URL`) and finance tables (`008_finance_payments_delta.sql`).
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
import { reclaimStaleProcessingHttpIdempotencyRecords } from "../src/http/http-idempotency-reclaim";
import { integrationTenantId, postgresFinanceEnsureTour, postgresFinanceSeedRegistration } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** Prefer DATABASE_URL_ADMIN for seed/cleanup (superuser bypasses RLS + owns audit triggers). */
function resolveFinanceOpsAdminUrl(): string {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  const appUrl = process.env.DATABASE_URL?.trim();
  if (adminUrl) {
    return adminUrl;
  }
  if (appUrl) {
    return appUrl;
  }
  return "postgresql://postgres:postgres@127.0.0.1:5434/app_cloud_dev";
}

async function ensureFinanceTables(admin: PrismaClient): Promise<void> {
  const rows = await admin.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'payments'
    ) AS exists
  `;
  if (rows[0]?.exists) {
    return;
  }

  await admin.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      registration_id UUID NOT NULL,
      amount TEXT NOT NULL,
      currency VARCHAR(8) NOT NULL,
      method TEXT NOT NULL DEFAULT 'Manual',
      provider TEXT NOT NULL DEFAULT 'manual',
      provider_payment_id TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      paid_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      refunded_at TIMESTAMPTZ,
      ledger_journal_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await admin.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments (tenant_id, status);
  `);
  await admin.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_payments_tenant_registration ON payments (tenant_id, registration_id);
  `);
  await admin.$executeRawUnsafe(`ALTER TABLE payments ENABLE ROW LEVEL SECURITY;`);
  await admin.$executeRawUnsafe(`ALTER TABLE payments FORCE ROW LEVEL SECURITY;`);
  await admin.$executeRawUnsafe(`DROP POLICY IF EXISTS payments_tenant_isolation ON payments;`);
  await admin.$executeRawUnsafe(`
    CREATE POLICY payments_tenant_isolation ON payments
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  `);

  await admin.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payment_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      payment_id UUID NOT NULL REFERENCES payments(id),
      file_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      note TEXT,
      reviewed_by_user_id TEXT,
      reviewed_at TIMESTAMPTZ,
      review_note TEXT,
      ledger_journal_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await admin.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant_status ON payment_receipts (tenant_id, status);
  `);
  await admin.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant_payment ON payment_receipts (tenant_id, payment_id);
  `);
  await admin.$executeRawUnsafe(`ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;`);
  await admin.$executeRawUnsafe(`ALTER TABLE payment_receipts FORCE ROW LEVEL SECURITY;`);
  await admin.$executeRawUnsafe(`DROP POLICY IF EXISTS payment_receipts_tenant_isolation ON payment_receipts;`);
  await admin.$executeRawUnsafe(`
    CREATE POLICY payment_receipts_tenant_isolation ON payment_receipts
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  `);
}

function authHeaders(
  tenantId: string,
  role: "admin" | "owner" | "member" = "admin",
  userId = "finance-ops-user"
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": role,
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-finance-ops",
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
    readonly userId?: string;
    readonly idempotencyKey?: string;
    readonly omitAuth?: boolean;
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
            ...(input.omitAuth === true
              ? {}
              : authHeaders(input.tenantId, input.role, input.userId)),
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

describe("finance-ops.spec.ts — Phase 9.7 + 3B", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  const denaliTenantBId = integrationTenantId();
  const urbanTenantId = integrationTenantId();
  const disabledFinanceTenantId = integrationTenantId();
  const denaliTourId = randomUUID();
  const denaliTourBId = randomUUID();
  let admin: PrismaClient;
  const listener = createRequestListener();
  const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;
  const tenantIds = () => [
    denaliTenantId,
    denaliTenantBId,
    urbanTenantId,
    disabledFinanceTenantId,
  ];

  before(async () => {
    process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER?.trim() || "prisma";
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
    resetHttpIdempotencyMemoryForTests();
    const adminUrl = resolveFinanceOpsAdminUrl();
    admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    await ensureFinanceTables(admin);
    await admin.tenant.createMany({
      data: [
        {
          id: denaliTenantId,
          subdomain: `fin-${denaliTenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
        {
          id: denaliTenantBId,
          subdomain: `finb-${denaliTenantBId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
        {
          id: urbanTenantId,
          subdomain: `urb-${urbanTenantId.slice(0, 8)}`,
          workspaceType: "urban",
          theme: {},
        },
        {
          id: disabledFinanceTenantId,
          subdomain: `fd-${disabledFinanceTenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: { enabledModules: ["tours"] },
        },
      ],
    });
    await postgresFinanceEnsureTour(admin, denaliTenantId, denaliTourId);
    await postgresFinanceEnsureTour(admin, denaliTenantBId, denaliTourBId);
  });

  beforeEach(async () => {
    delete process.env.PAYMENT_HOLD_ENABLED;
    delete process.env.PAYMENT_HOLD_EXPIRY_ENABLED;
    delete process.env.P5_ATOMIC_TX_TEST_ABORT;
    resetLazyFinanceServiceForTests();
    resetHttpIdempotencyMemoryForTests();
    for (const tenantId of tenantIds()) {
      await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId } });
      await admin.financeCommercialQuote.deleteMany({ where: { tenantId } });
      await admin.paymentReceipt.deleteMany({ where: { tenantId } });
      await admin.payment.deleteMany({ where: { tenantId } });
      await admin.operatorRegistration.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
    }
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
      await admin.tour.deleteMany({ where: { id: { in: [denaliTourId, denaliTourBId] } } });
      for (const tenantId of tenantIds()) {
        await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId } });
        await admin.financeCommercialQuote.deleteMany({ where: { tenantId } });
        await admin.paymentReceipt.deleteMany({ where: { tenantId } });
        await admin.payment.deleteMany({ where: { tenantId } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      }
    } finally {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
      );
    }
    await admin.$disconnect();
    await disconnectPrisma();
  });

  async function seedPendingReceipt(input: {
    readonly tenantId: string;
    readonly withBooking: boolean;
    readonly amount?: string;
  }): Promise<{
    readonly registrationId: string;
    readonly paymentId: string;
    readonly receiptId: string;
  }> {
    const registrationId = randomUUID();
    if (input.withBooking) {
      await postgresFinanceSeedRegistration(admin, {
        tenantId: input.tenantId,
        registrationId,
        tourId: input.tenantId === denaliTenantBId ? denaliTourBId : denaliTourId,
        amountMinor: input.amount ?? "5000000",
      });
    }
    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: input.tenantId,
      idempotencyKey: `manual-${registrationId}`,
      body: {
        registrationId,
        amount: input.amount ?? "5000000",
        currency: "IRR",
      },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const receipt = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: input.tenantId,
      idempotencyKey: `receipt-${paymentId}`,
      body: {
        paymentId,
        fileKey: `receipts/${paymentId}/proof.jpg`,
      },
    });
    assert.equal(receipt.status, 201);
    return { registrationId, paymentId, receiptId: String(receipt.body.id) };
  }

  it("API-9.7-01 urban tenant receives 404 FINANCE_WORKSPACE_UNSUPPORTED", async () => {
    const response = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/summary",
      tenantId: urbanTenantId,
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "FINANCE_WORKSPACE_UNSUPPORTED");
  });

  it("API-9.7-02 denali tenant without finance module receives 403", async () => {
    const response = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/summary",
      tenantId: disabledFinanceTenantId,
    });
    assert.equal(response.status, 403);
    assert.match(String(response.body.error), /FORBIDDEN_FINANCE_MODULE_DISABLED/);
  });

  it("API-9.7-03 manual payment → receipt → approve emits ledger outbox", async () => {
    const { registrationId, paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
      amount: "5000000",
    });

    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `ops-03-${receiptId}`,
      body: { decision: "approve", reviewNote: "verified" },
    });
    assert.equal(review.status, 200);
    assert.equal(review.body.status, "Approved");
    assert.ok(typeof review.body.ledgerJournalId === "string");
    assert.equal(review.body.bookingPaymentStatus, "paid");

    const booking = await admin.operatorRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentStatus: true },
    });
    assert.equal(booking?.paymentStatus, "paid");

    const summaryAfter = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/summary",
      tenantId: denaliTenantId,
    });
    assert.equal(summaryAfter.status, 200);
    assert.ok((summaryAfter.body.paidPayments as number) >= 1);

    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        eventType: "finance.ledger.double_entry_applied",
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledgerCount, 1);
  });

  it("API-9.7-03b approve without booking row fails closed (409 sync miss)", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: false,
      amount: "1000000",
    });

    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `ops-03b-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.equal(review.status, 409);
    assert.equal(review.body.code, "FINANCE_BOOKING_PAYMENT_SYNC_MISS");

    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    assert.equal(payment?.status, "Pending");
  });

  it("API-9.7-03c approve without Idempotency-Key returns 400", async () => {
    const { receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      body: { decision: "approve" },
    });
    assert.equal(review.status, 400);
  });

  it("API-9.7-04 member cannot access finance summary", async () => {
    const response = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/summary",
      tenantId: denaliTenantId,
      role: "member",
    });
    assert.equal(response.status, 403);
  });

  it("AUTHZ-RECEIPT-01 member can POST /finance/receipts for own registration payment", async () => {
    const ownerUserId = randomUUID();
    const registrationId = randomUUID();
    await postgresFinanceSeedRegistration(admin, {
      tenantId: denaliTenantId,
      registrationId,
      tourId: denaliTourId,
      amountMinor: "1500000",
      submittedByUserId: ownerUserId,
      guestLabel: "Owner Guest",
    });
    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey: `authz-own-pay-${registrationId}`,
      body: { registrationId, amount: "1500000", currency: "IRR" },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const receipt = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      role: "member",
      userId: ownerUserId,
      idempotencyKey: `authz-own-rcpt-${paymentId}`,
      body: { paymentId, fileKey: `receipts/${denaliTenantId}/${registrationId}/own.pdf` },
    });
    assert.equal(receipt.status, 201);
    assert.equal(receipt.body.paymentId, paymentId);
  });

  it("AUTHZ-RECEIPT-02 IDOR — member cannot POST /finance/receipts for another payment", async () => {
    const ownerUserId = randomUUID();
    const strangerUserId = randomUUID();
    const registrationId = randomUUID();
    await postgresFinanceSeedRegistration(admin, {
      tenantId: denaliTenantId,
      registrationId,
      tourId: denaliTourId,
      amountMinor: "1500000",
      submittedByUserId: ownerUserId,
      guestLabel: "Owner Guest",
    });
    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey: `authz-idor-pay-${registrationId}`,
      body: { registrationId, amount: "1500000", currency: "IRR" },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const stolen = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      role: "member",
      userId: strangerUserId,
      idempotencyKey: `authz-idor-rcpt-${paymentId}`,
      body: { paymentId, fileKey: `receipts/${denaliTenantId}/stolen.pdf` },
    });
    assert.equal(stolen.status, 403);
    assert.equal(stolen.body.code, "BOOKINGS_FORBIDDEN");
  });

  it("AUTHZ-RECEIPT-03 cross-tenant paymentId yields not found", async () => {
    const { paymentId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const cross = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantBId,
      role: "member",
      userId: randomUUID(),
      idempotencyKey: `authz-xtenant-${paymentId}`,
      body: { paymentId, fileKey: `receipts/cross.pdf` },
    });
    assert.equal(cross.status, 404);
    assert.equal(cross.body.code, "FINANCE_PAYMENT_NOT_FOUND");
  });

  it("AUTHZ-RECEIPT-04 missing identity is rejected", async () => {
    const response = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      omitAuth: true,
      idempotencyKey: "authz-missing-identity",
      body: {
        paymentId: randomUUID(),
        fileKey: "receipts/x.pdf",
      },
    });
    assert.ok(response.status === 401 || response.status === 403);
  });

  it("APPROVE-IDEM-01 same key retry → one approval + one ledger", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const idempotencyKey = `approve-idem-01-${receiptId}`;
    const body = { decision: "approve" as const };
    const first = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(first.status, 200);
    const second = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.id, first.body.id);
    assert.equal(second.body.status, "Approved");
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledgerCount, 1);
  });

  it("APPROVE-IDEM-02 concurrent same key → one logical execution", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const idempotencyKey = `approve-idem-02-${receiptId}`;
    const body = { decision: "approve" as const };
    const [a, b] = await Promise.all([
      requestJson(listener, {
        method: "PATCH",
        path: `/finance/receipts/${receiptId}/review`,
        tenantId: denaliTenantId,
        idempotencyKey,
        body,
      }),
      requestJson(listener, {
        method: "PATCH",
        path: `/finance/receipts/${receiptId}/review`,
        tenantId: denaliTenantId,
        idempotencyKey,
        body,
      }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.body.id, b.body.id);
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledgerCount, 1);
  });

  it("APPROVE-IDEM-03 different keys → one ledger + non-destructive second", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const body = { decision: "approve" as const };
    const first = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-idem-03a-${receiptId}`,
      body,
    });
    assert.equal(first.status, 200);
    const second = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-idem-03b-${receiptId}`,
      body,
    });
    // Phase 4B: already-Approved+Paid returns non-destructive replay (200) or conflict (409).
    assert.ok(second.status === 200 || second.status === 409);
    if (second.status === 200) {
      assert.equal(second.body.status, "Approved");
      assert.equal(second.body.id, first.body.id);
    }
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledgerCount, 1);
  });

  it("APPROVE-RACE-01 concurrent different keys → one capture ledger", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const body = { decision: "approve" as const };
    const [a, b] = await Promise.all([
      requestJson(listener, {
        method: "PATCH",
        path: `/finance/receipts/${receiptId}/review`,
        tenantId: denaliTenantId,
        idempotencyKey: `approve-race-01a-${receiptId}`,
        body,
      }),
      requestJson(listener, {
        method: "PATCH",
        path: `/finance/receipts/${receiptId}/review`,
        tenantId: denaliTenantId,
        idempotencyKey: `approve-race-01b-${receiptId}`,
        body,
      }),
    ]);
    const successes = [a, b].filter((r) => r.status === 200);
    assert.ok(successes.length >= 1, `expected ≥1 success; statuses=${a.status},${b.status}`);
    assert.ok(
      [a, b].every((r) => r.status === 200 || r.status === 409),
      `expected 200|409; statuses=${a.status},${b.status} bodies=${JSON.stringify([a.body, b.body])}`
    );
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledgerCount, 1);
    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    const receipt = await admin.paymentReceipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    assert.equal(payment?.status, "Paid");
    assert.equal(receipt?.status, "Approved");
  });

  it("APPROVE-GUARD-01 second sequential approve → no second ledger", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const first = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-guard-01a-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.equal(first.status, 200);
    const second = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-guard-01b-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.ok(second.status === 200 || second.status === 409);
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(ledgerCount, 1);
  });

  it("APPROVE-IDEM-04 same key different tenants → no collision", async () => {
    const seededA = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    const seededB = await seedPendingReceipt({
      tenantId: denaliTenantBId,
      withBooking: true,
    });
    const idempotencyKey = `approve-idem-04-shared`;
    const a = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${seededA.receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { decision: "approve" },
    });
    const b = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${seededB.receiptId}/review`,
      tenantId: denaliTenantBId,
      idempotencyKey,
      body: { decision: "approve" },
    });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.notEqual(a.body.id, b.body.id);
  });

  it("APPROVE-TX-01 booking missing → full rollback", async () => {
    const { paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: false,
    });
    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-tx-01-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.equal(review.status, 409);
    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    const receipt = await admin.paymentReceipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(payment?.status, "Pending");
    assert.equal(receipt?.status, "Pending");
    assert.equal(ledgerCount, 0);
  });

  it("APPROVE-TX-02 failure after payment → full rollback", async () => {
    const { registrationId, paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_approve_after_payment";
    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-tx-02-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.notEqual(review.status, 200);
    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    const receipt = await admin.paymentReceipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    const booking = await admin.operatorRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentStatus: true },
    });
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(payment?.status, "Pending");
    assert.equal(receipt?.status, "Pending");
    assert.equal(booking?.paymentStatus, "unpaid");
    assert.equal(ledgerCount, 0);
  });

  it("APPROVE-TX-03 failure after booking → full rollback", async () => {
    const { registrationId, paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_approve_after_booking";
    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-tx-03-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.notEqual(review.status, 200);
    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    const receipt = await admin.paymentReceipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    const booking = await admin.operatorRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentStatus: true },
    });
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(payment?.status, "Pending");
    assert.equal(receipt?.status, "Pending");
    assert.equal(booking?.paymentStatus, "unpaid");
    assert.equal(ledgerCount, 0);
  });

  it("APPROVE-TX-04 failure after receipt / before ledger commit → full rollback", async () => {
    const { registrationId, paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_approve_after_receipt";
    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-tx-04-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.notEqual(review.status, 200);
    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    const receipt = await admin.paymentReceipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    const booking = await admin.operatorRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentStatus: true },
    });
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(payment?.status, "Pending");
    assert.equal(receipt?.status, "Pending");
    assert.equal(booking?.paymentStatus, "unpaid");
    assert.equal(ledgerCount, 0);
  });

  it("APPROVE-TX-05 abort before mutations → zero durable side effects", async () => {
    const { registrationId, paymentId, receiptId } = await seedPendingReceipt({
      tenantId: denaliTenantId,
      withBooking: true,
    });
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_approve_before_commit";
    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      idempotencyKey: `approve-tx-05-${receiptId}`,
      body: { decision: "approve" },
    });
    assert.notEqual(review.status, 200);
    const payment = await admin.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    const receipt = await admin.paymentReceipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    const booking = await admin.operatorRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentStatus: true },
    });
    const ledgerCount = await admin.outboxEvent.count({
      where: {
        tenantId: denaliTenantId,
        domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      },
    });
    assert.equal(payment?.status, "Pending");
    assert.equal(receipt?.status, "Pending");
    assert.equal(booking?.paymentStatus, "unpaid");
    assert.equal(ledgerCount, 0);
  });

  it("PAY-CREATE-IDEM-01 same key → one payment", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `pay-create-idem-01-${registrationId}`;
    const body = {
      registrationId,
      amount: "3000000",
      currency: "IRR",
    };
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(first.status, 201);
    const second = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(second.status, 201);
    assert.equal(second.body.id, first.body.id);
    const count = await admin.payment.count({
      where: { tenantId: denaliTenantId, registrationId },
    });
    assert.equal(count, 1);
  });

  it("PAY-CREATE-IDEM-02 same key different body → payload mismatch", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `pay-create-idem-02-${registrationId}`;
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { registrationId, amount: "3000000", currency: "IRR" },
    });
    assert.equal(first.status, 201);
    const second = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { registrationId, amount: "3000001", currency: "IRR" },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "IDEMPOTENCY_PAYLOAD_MISMATCH");
    const count = await admin.payment.count({
      where: { tenantId: denaliTenantId, registrationId },
    });
    assert.equal(count, 1);
  });

  it("PAY-CREATE-CONCUR-01 concurrent same key → one payment", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `pay-create-concur-01-${registrationId}`;
    const body = { registrationId, amount: "3200000", currency: "IRR" };
    const [a, b] = await Promise.all([
      requestJson(listener, {
        method: "POST",
        path: "/finance/payments/manual",
        tenantId: denaliTenantId,
        idempotencyKey,
        body,
      }),
      requestJson(listener, {
        method: "POST",
        path: "/finance/payments/manual",
        tenantId: denaliTenantId,
        idempotencyKey,
        body,
      }),
    ]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(a.body.id, b.body.id);
    const count = await admin.payment.count({
      where: { tenantId: denaliTenantId, registrationId },
    });
    assert.equal(count, 1);
  });

  it("RECEIPT-SUBMIT-IDEM-01 same key → one receipt", async () => {
    const registrationId = randomUUID();
    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey: `receipt-submit-pay-${registrationId}`,
      body: { registrationId, amount: "4000000", currency: "IRR" },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const idempotencyKey = `receipt-submit-idem-01-${paymentId}`;
    const body = { paymentId, fileKey: `receipts/${paymentId}/idem.jpg` };
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(first.status, 201);
    const second = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(second.status, 201);
    assert.equal(second.body.id, first.body.id);
    const count = await admin.paymentReceipt.count({
      where: { tenantId: denaliTenantId, paymentId },
    });
    assert.equal(count, 1);
  });

  it("RECEIPT-SUBMIT-IDEM-02 same key different fileKey → payload mismatch", async () => {
    const registrationId = randomUUID();
    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey: `receipt-submit-pay-02-${registrationId}`,
      body: { registrationId, amount: "4000000", currency: "IRR" },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const idempotencyKey = `receipt-submit-idem-02-${paymentId}`;
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { paymentId, fileKey: `receipts/${paymentId}/a.jpg` },
    });
    assert.equal(first.status, 201);
    const second = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      idempotencyKey,
      body: { paymentId, fileKey: `receipts/${paymentId}/b.jpg` },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "IDEMPOTENCY_PAYLOAD_MISMATCH");
    const count = await admin.paymentReceipt.count({
      where: { tenantId: denaliTenantId, paymentId },
    });
    assert.equal(count, 1);
  });

  it("PAY-CREATE-RECLAIM-01 reclaim + retry → same payment id", async () => {
    const registrationId = randomUUID();
    const idempotencyKey = `pay-create-reclaim-01-${registrationId}`;
    const body = { registrationId, amount: "3100000", currency: "IRR" };
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(first.status, 201);
    const paymentId = String(first.body.id);

    await admin.httpIdempotencyRecord.update({
      where: {
        tenantId_idempotencyKey: { tenantId: denaliTenantId, idempotencyKey },
      },
      data: {
        status: "processing",
        responseBody: null,
        statusCode: null,
        completedAt: null,
        leaseUntil: new Date(Date.now() - 1_000),
        leaseOwner: "stale-pay-reclaim",
      },
    });
    await reclaimStaleProcessingHttpIdempotencyRecords(2_000);

    const retry = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(retry.status, 201);
    assert.equal(retry.body.id, paymentId);
    const count = await admin.payment.count({
      where: { tenantId: denaliTenantId, registrationId },
    });
    assert.equal(count, 1);
  });

  it("RECEIPT-SUBMIT-RECLAIM-01 reclaim + retry → same receipt id", async () => {
    const registrationId = randomUUID();
    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      idempotencyKey: `receipt-reclaim-pay-${registrationId}`,
      body: { registrationId, amount: "4100000", currency: "IRR" },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    const idempotencyKey = `receipt-submit-reclaim-01-${paymentId}`;
    const body = { paymentId, fileKey: `receipts/${paymentId}/reclaim.jpg` };
    const first = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(first.status, 201);
    const receiptId = String(first.body.id);

    await admin.httpIdempotencyRecord.update({
      where: {
        tenantId_idempotencyKey: { tenantId: denaliTenantId, idempotencyKey },
      },
      data: {
        status: "processing",
        responseBody: null,
        statusCode: null,
        completedAt: null,
        leaseUntil: new Date(Date.now() - 1_000),
        leaseOwner: "stale-receipt-reclaim",
      },
    });
    await reclaimStaleProcessingHttpIdempotencyRecords(2_000);

    const retry = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      idempotencyKey,
      body,
    });
    assert.equal(retry.status, 201);
    assert.equal(retry.body.id, receiptId);
    const count = await admin.paymentReceipt.count({
      where: { tenantId: denaliTenantId, paymentId },
    });
    assert.equal(count, 1);
  });
});
