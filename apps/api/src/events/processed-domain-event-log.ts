import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Claims `(tenantId, domainEventId)` in the processed log before handler side effects.
 * @returns true when this delivery may run business logic; false when already processed.
 */
export async function tryClaimProcessedDomainEvent(
  tenantId: string,
  domainEventId: string
): Promise<boolean> {
  const normalizedTenantId = tenantId.trim();
  const normalizedEventId = domainEventId.trim();
  if (!normalizedTenantId || !normalizedEventId) {
    throw new Error("PROCESSED_DOMAIN_EVENT_IDS_REQUIRED");
  }

  return withTenantRls(normalizedTenantId, async (tx) => {
    try {
      await tx.processedDomainEvent.create({
        data: {
          tenantId: normalizedTenantId,
          domainEventId: normalizedEventId,
        },
      });
      return true;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  });
}
