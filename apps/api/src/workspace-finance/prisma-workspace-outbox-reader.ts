import type {
  DenaliOutboxDomainEvent,
  OutboxReader,
  TourCreatedLedgerPayload,
} from "@app-tour/workspace-denali";

import { withTenantRls } from "../db/with-tenant-rls";
import { hasWorkspaceFinanceProcessedEvent } from "./workspace-finance-processed-log";

function tourCreatedHasFinancePayload(payload: Record<string, unknown>): boolean {
  const finance = payload as TourCreatedLedgerPayload;
  return Boolean(finance.registrationId?.trim() && finance.paidAmountMinor?.trim());
}

function mapOutboxRowToDenaliEvent(row: {
  tenantId: string;
  domainEventId: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}): DenaliOutboxDomainEvent | null {
  const domainEventId = row.domainEventId?.trim();
  if (!domainEventId) {
    return null;
  }
  const payload =
    typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    tenantId: row.tenantId,
    domainEventId,
    eventType: row.eventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload,
  };
}

export function createWorkspaceOutboxReader(tenantId: string): OutboxReader {
  return {
    async readPending(): Promise<readonly DenaliOutboxDomainEvent[]> {
      const rows = await withTenantRls(tenantId, (tx) =>
        tx.outboxEvent.findMany({
          where: {
            tenantId,
            eventType: "TourCreated",
            domainEventId: { not: null },
          },
          orderBy: { createdAt: "asc" },
          take: 64,
        })
      );

      const events: DenaliOutboxDomainEvent[] = [];
      for (const row of rows) {
        const mapped = mapOutboxRowToDenaliEvent(row);
        if (mapped === null) {
          continue;
        }
        if (await hasWorkspaceFinanceProcessedEvent(tenantId, mapped.domainEventId)) {
          continue;
        }
        if (!tourCreatedHasFinancePayload(mapped.payload)) {
          continue;
        }
        events.push(mapped);
      }
      return events;
    },
  };
}
