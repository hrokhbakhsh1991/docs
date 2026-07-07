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
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../src/boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../src/db/prisma";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** Local Docker uses `app_tour`; stale shell `postgres:postgres@127.0.0.1:5434` must not win over DATABASE_URL. */
function resolveFinanceOpsAdminUrl(): string {
  const appUrl = process.env.DATABASE_URL?.trim();
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  const staleLocalPostgresAdmin =
    adminUrl?.includes("postgres:postgres@127.0.0.1:5434") ?? false;
  if (adminUrl && !staleLocalPostgresAdmin) {
    return adminUrl;
  }
  if (appUrl) {
    return appUrl;
  }
  return "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";
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
  role: "admin" | "owner" | "member" = "admin"
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "finance-ops-user",
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

describe("finance-ops.spec.ts — Phase 9.7", { skip: !hasDatabase, concurrency: false }, () => {
  const denaliTenantId = integrationTenantId();
  const urbanTenantId = integrationTenantId();
  const disabledFinanceTenantId = integrationTenantId();
  let admin: PrismaClient;
  const listener = createRequestListener();

  before(async () => {
    resetLazyRouteHandlersForTests();
    resetLazyFinanceServiceForTests();
    resetLazyWorkspaceFinanceHandlersForTests();
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
  });

  after(async () => {
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
    );
    try {
      for (const tenantId of [denaliTenantId, urbanTenantId, disabledFinanceTenantId]) {
        await admin.paymentReceipt.deleteMany({ where: { tenantId } });
        await admin.payment.deleteMany({ where: { tenantId } });
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
    const registrationId = randomUUID();

    const summaryBefore = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/summary",
      tenantId: denaliTenantId,
    });
    assert.equal(summaryBefore.status, 200);
    assert.equal(summaryBefore.body.pendingManualPayments, 0);

    const manual = await requestJson(listener, {
      method: "POST",
      path: "/finance/payments/manual",
      tenantId: denaliTenantId,
      body: {
        registrationId,
        amount: "5000000",
        currency: "IRR",
      },
    });
    assert.equal(manual.status, 201);
    const paymentId = String(manual.body.id);
    assert.ok(paymentId.length > 0);

    const receipt = await requestJson(listener, {
      method: "POST",
      path: "/finance/receipts",
      tenantId: denaliTenantId,
      body: {
        paymentId,
        fileKey: `receipts/${paymentId}/proof.jpg`,
        note: "bank transfer",
      },
    });
    assert.equal(receipt.status, 201);
    const receiptId = String(receipt.body.id);

    const review = await requestJson(listener, {
      method: "PATCH",
      path: `/finance/receipts/${receiptId}/review`,
      tenantId: denaliTenantId,
      body: { decision: "approve", reviewNote: "verified" },
    });
    assert.equal(review.status, 200);
    assert.equal(review.body.status, "Approved");
    assert.ok(typeof review.body.ledgerJournalId === "string");

    const summaryAfter = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/summary",
      tenantId: denaliTenantId,
    });
    assert.equal(summaryAfter.status, 200);
    assert.equal(summaryAfter.body.paidPayments, 1);

    const ledger = await requestJson(listener, {
      method: "GET",
      path: "/finance/reports/ledger-events?limit=5",
      tenantId: denaliTenantId,
    });
    assert.equal(ledger.status, 200);
    const items = ledger.body.items as unknown[];
    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 1);
    const first = items[0] as Record<string, unknown>;
    assert.equal(first.eventType, "finance.ledger.double_entry_applied");
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
});
