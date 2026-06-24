/**
 * P7-3-N-001 — idempotent pending booking on operator smoke tour (Postgres SoT).
 * Mirrors `operator-bookings-fixture.ts` row …0310 for SMK-P9-04 / SMK-P6-ADM-02 E2E.
 *
 * Staging hygiene: clears **all** Pending receipts/payments on tenant …014 so repeated
 * portal receipt smokes (proof.jpg) do not inflate the finance queue and flake ADM-02.
 */
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { logger } from "../src/observability/logger";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant.ts";

export const OPERATOR_SMOKE_PENDING_GUEST_LABEL = "Ali Rezaei" as const;
export const OPERATOR_SMOKE_VS07_PAYMENT_ID =
  "00000000-0000-4000-8000-000000000407" as const;
export const OPERATOR_SMOKE_VS07_RECEIPT_ID =
  "00000000-0000-4000-8000-000000000408" as const;
export const OPERATOR_SMOKE_VS07_FILE_KEY =
  `receipts/${OPERATOR_SMOKE.pendingBookingId}/p6-vs07-smoke.jpg` as const;

export async function seedOperatorSmokePendingBooking(): Promise<string> {
  const prisma = getPrismaAdmin();
  const now = new Date();
  const departureAt = new Date(now);
  departureAt.setUTCDate(departureAt.getUTCDate() + 5);

  // Drop stale pending finance rows from prior smoke runs (portal PTL-04 uploads, etc.).
  await prisma.paymentReceipt.deleteMany({
    where: {
      tenantId: OPERATOR_SMOKE.tenantId,
      status: "Pending",
    },
  });
  await prisma.payment.deleteMany({
    where: {
      tenantId: OPERATOR_SMOKE.tenantId,
      status: "Pending",
    },
  });

  await withTenantRls(OPERATOR_SMOKE.tenantId, (tx) =>
    tx.operatorRegistration.upsert({
      where: { id: OPERATOR_SMOKE.pendingBookingId },
      create: {
        id: OPERATOR_SMOKE.pendingBookingId,
        tenantId: OPERATOR_SMOKE.tenantId,
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "North Ridge Trek",
        guestLabel: OPERATOR_SMOKE_PENDING_GUEST_LABEL,
        guestEmail: "ali@example.com",
        guestPhone: "+15550002001",
        partySize: 2,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt,
        submittedAt: now,
        submittedByUserId: OPERATOR_SMOKE.memberUserId,
        approvedAt: null,
      },
      update: {
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "North Ridge Trek",
        guestLabel: OPERATOR_SMOKE_PENDING_GUEST_LABEL,
        guestEmail: "ali@example.com",
        guestPhone: "+15550002001",
        partySize: 2,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt,
        submittedAt: now,
        approvedAt: null,
      },
    })
  );

  await withTenantRls(OPERATOR_SMOKE.tenantId, async (tx) => {
    await tx.payment.upsert({
      where: { id: OPERATOR_SMOKE_VS07_PAYMENT_ID },
      create: {
        id: OPERATOR_SMOKE_VS07_PAYMENT_ID,
        tenantId: OPERATOR_SMOKE.tenantId,
        registrationId: OPERATOR_SMOKE.pendingBookingId,
        amount: "2500000",
        currency: "IRR",
        method: "Manual",
        provider: "manual",
        status: "Pending",
      },
      update: {
        registrationId: OPERATOR_SMOKE.pendingBookingId,
        amount: "2500000",
        currency: "IRR",
        method: "Manual",
        status: "Pending",
        paidAt: null,
        ledgerJournalId: null,
      },
    });

    await tx.paymentReceipt.upsert({
      where: { id: OPERATOR_SMOKE_VS07_RECEIPT_ID },
      create: {
        id: OPERATOR_SMOKE_VS07_RECEIPT_ID,
        tenantId: OPERATOR_SMOKE.tenantId,
        paymentId: OPERATOR_SMOKE_VS07_PAYMENT_ID,
        fileKey: OPERATOR_SMOKE_VS07_FILE_KEY,
        status: "Pending",
      },
      update: {
        paymentId: OPERATOR_SMOKE_VS07_PAYMENT_ID,
        fileKey: OPERATOR_SMOKE_VS07_FILE_KEY,
        status: "Pending",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
        ledgerJournalId: null,
      },
    });
  });

  logger.info(
    {
      event: "db.seed.operator_smoke_pending_booking",
      tenantId: OPERATOR_SMOKE.tenantId,
      bookingId: OPERATOR_SMOKE.pendingBookingId,
      tourId: OPERATOR_SMOKE.seedTourId,
      receiptId: OPERATOR_SMOKE_VS07_RECEIPT_ID,
    },
    "operator smoke pending booking seeded"
  );

  return OPERATOR_SMOKE.pendingBookingId;
}

async function main(): Promise<void> {
  const bookingId = await seedOperatorSmokePendingBooking();
  console.log("OPERATOR_SMOKE_PENDING_BOOKING_SEED_OK", bookingId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
