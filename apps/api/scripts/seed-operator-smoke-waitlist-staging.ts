/**
 * P7-2-N-004 — idempotent waitlisted booking on operator smoke tour (Postgres SoT).
 * Mirrors `operator-bookings-fixture.ts` row …0312 for workspace waitlist promote probes.
 */
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { logger } from "../src/observability/logger";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant.ts";

export const OPERATOR_SMOKE_WAITLIST_BOOKING_ID =
  "00000000-0000-4000-8000-000000000312" as const;

export const OPERATOR_SMOKE_WAITLIST_GUEST_LABEL = "Jamal Hosseini" as const;

export async function seedOperatorSmokeWaitlistBooking(): Promise<string> {
  const prisma = getPrismaAdmin();
  const now = new Date();
  const departureAt = new Date(now);
  departureAt.setUTCDate(departureAt.getUTCDate() + 5);

  await withTenantRls(OPERATOR_SMOKE.tenantId, (tx) =>
    tx.operatorRegistration.upsert({
      where: { id: OPERATOR_SMOKE_WAITLIST_BOOKING_ID },
      create: {
        id: OPERATOR_SMOKE_WAITLIST_BOOKING_ID,
        tenantId: OPERATOR_SMOKE.tenantId,
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "North Ridge Trek",
        guestLabel: OPERATOR_SMOKE_WAITLIST_GUEST_LABEL,
        guestEmail: "jamal@example.com",
        guestPhone: "+15550002003",
        partySize: 3,
        status: "waitlisted",
        paymentStatus: "partial",
        departureAt,
        submittedAt: now,
        submittedByUserId: OPERATOR_SMOKE.ownerUserId,
        approvedAt: null,
      },
      update: {
        tourId: OPERATOR_SMOKE.seedTourId,
        tourTitle: "North Ridge Trek",
        guestLabel: OPERATOR_SMOKE_WAITLIST_GUEST_LABEL,
        partySize: 3,
        status: "waitlisted",
        paymentStatus: "partial",
        departureAt,
        submittedAt: now,
        approvedAt: null,
      },
    })
  );

  logger.info(
    {
      event: "db.seed.operator_smoke_waitlist",
      tenantId: OPERATOR_SMOKE.tenantId,
      bookingId: OPERATOR_SMOKE_WAITLIST_BOOKING_ID,
      tourId: OPERATOR_SMOKE.seedTourId,
    },
    "operator smoke waitlisted booking seeded"
  );

  return OPERATOR_SMOKE_WAITLIST_BOOKING_ID;
}

async function main(): Promise<void> {
  const bookingId = await seedOperatorSmokeWaitlistBooking();
  console.log("OPERATOR_SMOKE_WAITLIST_SEED_OK", bookingId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
