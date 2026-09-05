/**
 * E2E helper — bind operator-created booking to portal member for notification fan-out.
 */
import { PrismaClient } from "@prisma/client";

async function main(): Promise<void> {
  const tenantId = process.env.E2E_TENANT_ID?.trim();
  const bookingId = process.env.E2E_BOOKING_ID?.trim();
  const memberUserId = process.env.E2E_MEMBER_USER_ID?.trim();
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!tenantId || !bookingId || !memberUserId || !adminUrl) {
    throw new Error("E2E_TENANT_ID, E2E_BOOKING_ID, E2E_MEMBER_USER_ID, DATABASE_URL_ADMIN required");
  }

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    const updated = await admin.operatorRegistration.updateMany({
      where: { id: bookingId, tenantId },
      data: { submittedByUserId: memberUserId },
    });
    if (updated.count !== 1) {
      throw new Error(`expected 1 booking row updated, got ${updated.count}`);
    }
    console.log(JSON.stringify({ tenantId, bookingId, memberUserId, updated: updated.count }));
  } finally {
    await admin.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
