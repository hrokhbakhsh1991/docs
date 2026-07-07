/**
 * P7-2-N-003 — verify registration.approved outbox row exists for a booking (Postgres SoT).
 */
import { getPrismaAdmin } from "../src/db/prisma";

const BOOKING_ID = process.argv[2]?.trim();

async function main(): Promise<void> {
  if (BOOKING_ID === undefined || BOOKING_ID.length === 0) {
    throw new Error("usage: verify-booking-approve-outbox-staging.ts <bookingId>");
  }

  const prisma = getPrismaAdmin();
  const rows = await prisma.outboxEvent.findMany({
    where: {
      aggregateId: BOOKING_ID,
      aggregateType: "registration",
      eventType: "registration.approved",
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (rows.length === 0) {
    throw new Error(`outbox missing registration.approved for booking ${BOOKING_ID}`);
  }

  console.log(
    "BOOKING_APPROVE_OUTBOX_OK",
    rows[0]?.id,
    rows[0]?.status,
    rows[0]?.eventType
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
