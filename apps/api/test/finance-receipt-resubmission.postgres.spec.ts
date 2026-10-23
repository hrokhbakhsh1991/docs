import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { PrismaFinanceRepository } from "../src/workspace-finance/infrastructure/prisma-finance.repository";
import {
  integrationTenantId,
  postgresFinanceEnsureTour,
  postgresFinanceSeedRegistration,
} from "./test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

describe(
  "finance-receipt-resubmission.postgres.spec.ts",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const tourId = randomUUID();
    const registrationId = randomUUID();
    let tenantCreated = false;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `receipt-retry-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      tenantCreated = true;
      await postgresFinanceEnsureTour(admin, tenantId, tourId);
      await postgresFinanceSeedRegistration(admin, { tenantId, registrationId, tourId });
    });

    after(async () => {
      if (tenantCreated) {
        const admin = getPrismaAdmin();
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.paymentReceipt.deleteMany({ where: { tenantId } });
        await admin.payment.deleteMany({ where: { tenantId } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      }
      await disconnectPrisma();
    });

    it("persists rejected text receipt and resolves a same-time file retry as active", async () => {
      const repository = new PrismaFinanceRepository({} as never);
      const payment = await repository.createManualPayment({
        tenantId,
        registrationId,
        amount: "5000000",
        currency: "IRR",
        method: "Manual",
        provider: "manual",
        status: "Pending",
      });

      const initial = await repository.createReceipt({
        tenantId,
        paymentId: payment.id,
        fileKey: null,
        note: "رسید متنی آزمایشی",
      });
      const rejected = await repository.updateReceiptReview(tenantId, initial.id, {
        status: "Rejected",
        reviewedByUserId: randomUUID(),
        reviewNote: "لطفاً تصویر خوانا ارسال شود",
      });
      assert.equal(rejected.status, "Rejected");

      const retry = await repository.createReceipt({
        tenantId,
        paymentId: payment.id,
        fileKey: `qa-only://${randomUUID()}`,
        note: "توضیح همراه فیش آزمایشی",
      });

      const admin = getPrismaAdmin();
      await admin.paymentReceipt.update({
        where: { id: initial.id },
        data: { createdAt: retry.createdAt },
      });

      const persisted = await repository.findLatestReceiptForRegistration(tenantId, registrationId);
      const rows = await admin.paymentReceipt.findMany({
        where: { tenantId, paymentId: payment.id },
        orderBy: { id: "asc" },
      });

      assert.equal(rows.length, 2);
      assert.equal(rows.filter((row) => row.status === "Pending").length, 1);
      assert.equal(rows.filter((row) => row.status === "Rejected").length, 1);
      assert.equal(persisted?.id, retry.id);
      assert.equal(persisted?.status, "Pending");
      assert.equal(persisted?.paymentId, payment.id);
      assert.match(persisted?.fileKey ?? "", /^qa-only:\/\//);
      assert.equal(persisted?.note, "توضیح همراه فیش آزمایشی");
    });
  }
);

describe("finance-receipt-resubmission.postgres.spec.ts skip marker", { skip: hasDatabase }, () => {
  it("FINANCE_RECEIPT_POSTGRES_REQUIRES_DATABASE", () => {
    assert.ok(true);
  });
});
