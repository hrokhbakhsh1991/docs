import { withTenantRls } from "../db/with-tenant-rls";
import { tryClaimProcessedDomainEvent } from "../events/processed-domain-event-log";

const FINANCE_PROCESSED_PREFIX = "workspace-finance:";

export function workspaceFinanceProcessedDomainEventId(domainEventId: string): string {
  const normalized = domainEventId.trim();
  return `${FINANCE_PROCESSED_PREFIX}${normalized}`;
}

/**
 * Finance consumer idempotency — separate claim namespace from projection subscribers (P5.4-S4).
 */
export async function tryClaimWorkspaceFinanceProcessedEvent(
  tenantId: string,
  domainEventId: string
): Promise<boolean> {
  return tryClaimProcessedDomainEvent(tenantId, workspaceFinanceProcessedDomainEventId(domainEventId));
}

export async function hasWorkspaceFinanceProcessedEvent(
  tenantId: string,
  domainEventId: string
): Promise<boolean> {
  const claimId = workspaceFinanceProcessedDomainEventId(domainEventId);
  const row = await withTenantRls(tenantId, (tx) =>
    tx.processedDomainEvent.findUnique({
      where: {
        tenantId_domainEventId: { tenantId, domainEventId: claimId },
      },
    })
  );
  return row !== null;
}

export function createWorkspaceFinanceProcessedStore(tenantId: string): {
  hasProcessed(domainEventId: string): Promise<boolean>;
  markProcessed(domainEventId: string): Promise<void>;
} {
  return {
    async hasProcessed(domainEventId: string): Promise<boolean> {
      return hasWorkspaceFinanceProcessedEvent(tenantId, domainEventId);
    },
    async markProcessed(domainEventId: string): Promise<void> {
      await tryClaimWorkspaceFinanceProcessedEvent(tenantId, domainEventId);
    },
  };
}
