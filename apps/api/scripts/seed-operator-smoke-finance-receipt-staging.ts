/**
 * P7-2-N-007 — idempotent pending finance receipt on operator smoke tenant (Postgres SoT).
 * Seeds approved registration + manual payment + Pending receipt for /finance?tab=receipts probes.
 */
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { logger } from "../src/observability/logger";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant.ts";

export const OPERATOR_SMOKE_FINANCE_REGISTRATION_ID =
  "00000000-0000-4000-8000-000000000313" as const;
export const OPERATOR_SMOKE_FINANCE_PAYMENT_ID =
  "00000000-0000-4000-8000-000000000401" as const;
export const OPERATOR_SMOKE_FINANCE_RECEIPT_ID =
  "00000000-0000-4000-8000-000000000402" as const;
export const OPERATOR_SMOKE_FINANCE_RECEIPT_MARKER =
  "P7 staging finance receipt" as const;
export const OPERATOR_SMOKE_FINANCE_FILE_KEY =
  "receipts/p7-staging-finance-proof.jpg" as const;

export async function seedOperatorSmokeFinanceReceipt(): Promise<string> {
  const now = new Date();
  const departureAt = new Date(now);
  departureAt.setUTCDate(departureAt.getUTCDate() + 5);

  await withTenantRls(OPERATOR_SMOKE.tenantId, async (tx) => {
    await tx.operatorRegistration.upsert({
      where: { id: OPERATOR_SMOKE_FINANCE_REGISTRATION_ID },
      create: {
        id: OPERATOR_SMOKE_FINANCE_REGISTRATION_ID,
        tenantId: OPERATOR_SMOKE.tenantId,
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "North Ridge Trek",
        guestLabel: "P7 Finance Guest",
        guestEmail: "p7-finance-guest@staging.test",
        guestPhone: "+15550002004",
        partySize: 2,
        status: "approved",
        paymentStatus: "unpaid",
        departureAt,
        submittedAt: now,
        submittedByUserId: OPERATOR_SMOKE.ownerUserId,
        approvedAt: now,
      },
      update: {
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "North Ridge Trek",
        guestLabel: "P7 Finance Guest",
        status: "approved",
        approvedAt: now,
      },
    });

    await tx.payment.upsert({
      where: { id: OPERATOR_SMOKE_FINANCE_PAYMENT_ID },
      create: {
        id: OPERATOR_SMOKE_FINANCE_PAYMENT_ID,
        tenantId: OPERATOR_SMOKE.tenantId,
        registrationId: OPERATOR_SMOKE_FINANCE_REGISTRATION_ID,
        amount: "5000000",
        currency: "IRR",
        method: "Manual",
        provider: "manual",
        status: "Pending",
      },
      update: {
        registrationId: OPERATOR_SMOKE_FINANCE_REGISTRATION_ID,
        amount: "5000000",
        currency: "IRR",
        method: "Manual",
        status: "Pending",
      },
    });

    await tx.paymentReceipt.upsert({
      where: { id: OPERATOR_SMOKE_FINANCE_RECEIPT_ID },
      create: {
        id: OPERATOR_SMOKE_FINANCE_RECEIPT_ID,
        tenantId: OPERATOR_SMOKE.tenantId,
        paymentId: OPERATOR_SMOKE_FINANCE_PAYMENT_ID,
        fileKey: OPERATOR_SMOKE_FINANCE_FILE_KEY,
        status: "Pending",
        note: OPERATOR_SMOKE_FINANCE_RECEIPT_MARKER,
      },
      update: {
        paymentId: OPERATOR_SMOKE_FINANCE_PAYMENT_ID,
        fileKey: OPERATOR_SMOKE_FINANCE_FILE_KEY,
        status: "Pending",
        note: OPERATOR_SMOKE_FINANCE_RECEIPT_MARKER,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
        ledgerJournalId: null,
      },
    });
  });

  logger.info(
    {
      event: "db.seed.operator_smoke_finance_receipt",
      tenantId: OPERATOR_SMOKE.tenantId,
      receiptId: OPERATOR_SMOKE_FINANCE_RECEIPT_ID,
    },
    "operator smoke pending finance receipt seeded"
  );

  return OPERATOR_SMOKE_FINANCE_RECEIPT_ID;
}

async function main(): Promise<void> {
  const receiptId = await seedOperatorSmokeFinanceReceipt();
  console.log("OPERATOR_SMOKE_FINANCE_RECEIPT_SEED_OK", receiptId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
