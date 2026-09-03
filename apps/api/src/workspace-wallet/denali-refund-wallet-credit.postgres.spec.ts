/**
 * Phase 3 — Denali manual refund → wallet credit (Postgres + RLS).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { FORBIDDEN_WALLET_MODULE_DISABLED } from "@app-tour/workspace-sdk/wallet";

import { DENALI_WALLET_PILOT } from "../../test/fixtures/denali-wallet-pilot-tenant";
import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { seedDenaliWalletPilot } from "../../scripts/seed-denali-wallet-pilot";
import { ensureAppTourCanReadMigrationHead } from "../../scripts/seed-wallet-ws1-certification";
import {
  buildRefundWalletCreditIdempotencyKey,
  creditCompletedRefundToWallet,
  REFUND_WALLET_REFERENCE_TYPE,
} from "./refund-wallet-credit";
import { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = !hasDatabase ? "DENALI_REFUND_WALLET_CREDIT_REQUIRES_DATABASE" : false;

function operatorAuth(tenantId: string, userId: string) {
  return {
    tenantId,
    userId,
    role: "admin" as const,
    status: "ACTIVE" as const,
    workspaceId: DENALI_WALLET_PILOT.workspaceId,
  };
}

function memberAuth(tenantId: string, userId: string) {
  return {
    tenantId,
    userId,
    role: "member" as const,
    status: "ACTIVE" as const,
    workspaceId: DENALI_WALLET_PILOT.workspaceId,
  };
}

async function seedCompletedRefundRow(input: {
  readonly registrationId: string;
  readonly refundId: string;
  readonly paymentId: string;
  readonly amountMinor: string;
  readonly submittedByUserId: string;
  readonly status?: "Completed" | "Requested";
}): Promise<void> {
  const tenantId = DENALI_WALLET_PILOT.tenantId;
  const tourId = randomUUID();

  await withTenantRls(tenantId, async (tx) => {
    await tx.operatorRegistration.upsert({
      where: { id: input.registrationId },
      create: {
        id: input.registrationId,
        tenantId,
        tourId,
        tourTitle: "Pilot Refund Wallet Tour",
        guestLabel: "Pilot Member",
        partySize: 1,
        status: "approved",
        paymentStatus: "paid",
        departureAt: new Date("2026-09-01T00:00:00.000Z"),
        submittedAt: new Date("2026-08-01T00:00:00.000Z"),
        submittedByUserId: input.submittedByUserId,
        approvedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
      update: {
        submittedByUserId: input.submittedByUserId,
      },
    });

    await tx.payment.upsert({
      where: { id: input.paymentId },
      create: {
        id: input.paymentId,
        tenantId,
        registrationId: input.registrationId,
        amount: input.amountMinor,
        currency: DENALI_WALLET_PILOT.currency,
        method: "Manual",
        provider: "manual",
        status: "Paid",
      },
      update: {
        status: "Paid",
        amount: input.amountMinor,
      },
    });

    await tx.financeRefund.upsert({
      where: { id: input.refundId },
      create: {
        id: input.refundId,
        tenantId,
        registrationId: input.registrationId,
        paymentId: input.paymentId,
        sourceKind: "payment",
        amountMinor: input.amountMinor,
        currency: DENALI_WALLET_PILOT.currency,
        reasonCode: "overpayment",
        status: input.status ?? "Completed",
        requestedAt: new Date("2026-08-10T00:00:00.000Z"),
        requestedByUserId: DENALI_WALLET_PILOT.ownerUserId,
        completedAt: input.status === "Requested" ? null : new Date("2026-08-11T00:00:00.000Z"),
        completedByUserId:
          input.status === "Requested" ? null : DENALI_WALLET_PILOT.ownerUserId,
        creationIdempotencyKey: `refund-wallet-credit-seed:${input.refundId}`,
      },
      update: {
        status: input.status ?? "Completed",
      },
    });
  });
}

async function creditInPilotContext(
  auth: ReturnType<typeof operatorAuth>,
  refundId: string
) {
  return runWithTenantContext(
    DENALI_WALLET_PILOT.tenantId,
    () => creditCompletedRefundToWallet(auth, refundId),
    { actorId: auth.userId }
  );
}

describe(
  "denali-refund-wallet-credit.postgres.spec.ts — Phase 3",
  { skip: postgresSkip, concurrency: false },
  () => {
    const priorDriver = process.env.STORAGE_DRIVER;
    const repo = new PrismaWalletRepository();

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await ensureAppTourCanReadMigrationHead();
      await seedDenaliWalletPilot();
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      await disconnectPrisma();
    });

    it("RW-PG-01 credits completed refund to member wallet", async () => {
      const registrationId = randomUUID();
      const refundId = randomUUID();
      const paymentId = randomUUID();
      const amountMinor = "25000";

      await runWithTenantContext(
        DENALI_WALLET_PILOT.tenantId,
        () =>
          seedCompletedRefundRow({
            registrationId,
            refundId,
            paymentId,
            amountMinor,
            submittedByUserId: DENALI_WALLET_PILOT.entitledMemberUserId,
          }),
        { actorId: DENALI_WALLET_PILOT.ownerUserId }
      );

      const auth = operatorAuth(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT.ownerUserId);
      const result = await creditInPilotContext(auth, refundId);

      assert.equal(result.refundId, refundId);
      assert.equal(result.replay, false);
      assert.equal(result.walletCredit.credited, true);

      const byReference = await repo.findPostedTransactionByReference(
        DENALI_WALLET_PILOT.tenantId,
        REFUND_WALLET_REFERENCE_TYPE,
        refundId
      );
      assert.notEqual(byReference, null);
      assert.equal(byReference?.amountMinor, amountMinor);
      assert.equal(byReference?.reference?.type, REFUND_WALLET_REFERENCE_TYPE);
      assert.equal(byReference?.reference?.id, refundId);
    });

    it("RW-PG-02 rejects non-completed refund", async () => {
      const registrationId = randomUUID();
      const refundId = randomUUID();
      const paymentId = randomUUID();
      const auth = operatorAuth(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT.ownerUserId);

      await seedCompletedRefundRow({
        registrationId,
        refundId,
        paymentId,
        amountMinor: "10000",
        submittedByUserId: DENALI_WALLET_PILOT.entitledMemberUserId,
        status: "Requested",
      });

      await assert.rejects(
        () => creditInPilotContext(auth, refundId),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, "REFUND_WALLET_NOT_COMPLETED");
          return true;
        }
      );
    });

    it("RW-PG-03 rejects missing member owner", async () => {
      const registrationId = randomUUID();
      const refundId = randomUUID();
      const paymentId = randomUUID();
      const auth = operatorAuth(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT.ownerUserId);

      await seedCompletedRefundRow({
        registrationId,
        refundId,
        paymentId,
        amountMinor: "5000",
        submittedByUserId: "00000000-0000-4000-8000-000000000499",
      });

      await assert.rejects(
        () => creditInPilotContext(auth, refundId),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, "REFUND_WALLET_MEMBER_OWNER_MISSING");
          return true;
        }
      );
    });

    it("RW-PG-04 rejects wallet-disabled tenant", async () => {
      const auth = operatorAuth(DENALI_SMOKE_TENANT_ID, DENALI_WALLET_PILOT.ownerUserId);
      await assert.rejects(
        () => creditInPilotContext(auth, randomUUID()),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, FORBIDDEN_WALLET_MODULE_DISABLED);
          return true;
        }
      );
    });

    it("RW-PG-05 rejects non-admin member", async () => {
      const auth = memberAuth(
        DENALI_WALLET_PILOT.tenantId,
        DENALI_WALLET_PILOT.entitledMemberUserId
      );
      await assert.rejects(
        () => creditInPilotContext(auth, randomUUID()),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, "FORBIDDEN_OPERATOR_FORBIDDEN");
          return true;
        }
      );
    });

    it("RW-PG-06 idempotent retry replays same transaction", async () => {
      const registrationId = randomUUID();
      const refundId = randomUUID();
      const paymentId = randomUUID();
      const auth = operatorAuth(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT.ownerUserId);

      await seedCompletedRefundRow({
        registrationId,
        refundId,
        paymentId,
        amountMinor: "12000",
        submittedByUserId: DENALI_WALLET_PILOT.entitledMemberUserId,
      });

      const first = await creditInPilotContext(auth, refundId);
      const second = await creditInPilotContext(auth, refundId);
      assert.equal(first.transactionId, second.transactionId);
      assert.equal(second.replay, true);
    });

    it("RW-PG-07 concurrent duplicate requests cannot double-credit", async () => {
      const registrationId = randomUUID();
      const refundId = randomUUID();
      const paymentId = randomUUID();
      const auth = operatorAuth(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT.ownerUserId);

      await seedCompletedRefundRow({
        registrationId,
        refundId,
        paymentId,
        amountMinor: "8000",
        submittedByUserId: DENALI_WALLET_PILOT.entitledMemberUserId,
      });

      const results = await Promise.allSettled([
        creditInPilotContext(auth, refundId),
        creditInPilotContext(auth, refundId),
      ]);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof creditInPilotContext>>> =>
          result.status === "fulfilled"
      );
      assert.ok(fulfilled.length >= 1);
      const transactionIds = new Set(fulfilled.map((result) => result.value.transactionId));
      assert.equal(transactionIds.size, 1);

      const rows = await getPrismaAdmin().walletTransaction.findMany({
        where: {
          tenantId: DENALI_WALLET_PILOT.tenantId,
          referenceType: REFUND_WALLET_REFERENCE_TYPE,
          referenceId: refundId,
        },
      });
      assert.equal(rows.length, 1);
    });

    it("RW-PG-08 finance refund row unchanged after wallet credit", async () => {
      const registrationId = randomUUID();
      const refundId = randomUUID();
      const paymentId = randomUUID();
      const auth = operatorAuth(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT.ownerUserId);

      await seedCompletedRefundRow({
        registrationId,
        refundId,
        paymentId,
        amountMinor: "15000",
        submittedByUserId: DENALI_WALLET_PILOT.entitledMemberUserId,
      });

      const before = await getPrismaAdmin().financeRefund.findUnique({
        where: { id: refundId },
      });
      assert.notEqual(before, null);

      await creditInPilotContext(auth, refundId);

      const after = await getPrismaAdmin().financeRefund.findUnique({
        where: { id: refundId },
      });
      assert.notEqual(after, null);
      assert.equal(after?.status, before?.status);
      assert.equal(after?.amountMinor, before?.amountMinor);
      assert.equal(after?.currency, before?.currency);
    });

    it("RW-PG-09 idempotency key matches contract", () => {
      const key = buildRefundWalletCreditIdempotencyKey(
        DENALI_WALLET_PILOT.tenantId,
        "refund-abc"
      );
      assert.equal(
        key,
        `wallet:refund-credit:${DENALI_WALLET_PILOT.tenantId}:refund-abc`
      );
    });
  }
);
