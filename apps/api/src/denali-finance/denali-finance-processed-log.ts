import { withTenantRls } from "../db/with-tenant-rls";
import { tryClaimProcessedDomainEvent } from "../events/processed-domain-event-log";

const FINANCE_PROCESSED_PREFIX = "denali-finance:";

export function denaliFinanceProcessedDomainEventId(domainEventId: string): string {
  const normalized = domainEventId.trim();
  return `${FINANCE_PROCESSED_PREFIX}${normalized}`;
}

/**
 * Finance consumer idempotency — separate claim namespace from projection subscribers (P5.4-S4).
 */
export async function tryClaimDenaliFinanceProcessedEvent(
  tenantId: string,
  domainEventId: string
): Promise<boolean> {
  return tryClaimProcessedDomainEvent(tenantId, denaliFinanceProcessedDomainEventId(domainEventId));
}

export async function hasDenaliFinanceProcessedEvent(
  tenantId: string,
  domainEventId: string
): Promise<boolean> {
  const claimId = denaliFinanceProcessedDomainEventId(domainEventId);
  const row = await withTenantRls(tenantId, (tx) =>
    tx.processedDomainEvent.findUnique({
      where: {
        tenantId_domainEventId: { tenantId, domainEventId: claimId },
      },
    })
  );
  return row !== null;
}

export function createDenaliFinanceProcessedStore(tenantId: string): {
  hasProcessed(domainEventId: string): Promise<boolean>;
  markProcessed(domainEventId: string): Promise<void>;
} {
  return {
    async hasProcessed(domainEventId: string): Promise<boolean> {
      return hasDenaliFinanceProcessedEvent(tenantId, domainEventId);
    },
    async markProcessed(domainEventId: string): Promise<void> {
      await tryClaimDenaliFinanceProcessedEvent(tenantId, domainEventId);
    },
  };
}
