/**
 * Host Prisma OutboxReader for TourCreated → finance batch reactions.
 * Types are host-owned (Phase 1.7 C2) — no Denali package imports.
 */
import { withTenantRls } from "../db/with-tenant-rls";
import type {
  FinanceWorkspaceOutboxEvent,
  FinanceWorkspaceOutboxReader,
} from "./ports/finance-workspace-outbox-reader.port";
import { hasWorkspaceFinanceProcessedEvent } from "./workspace-finance-processed-log";

function tourCreatedHasFinancePayload(payload: Record<string, unknown>): boolean {
  const registrationId =
    typeof payload.registrationId === "string" ? payload.registrationId.trim() : "";
  const paidAmountMinor =
    typeof payload.paidAmountMinor === "string" ? payload.paidAmountMinor.trim() : "";
  return registrationId.length > 0 && paidAmountMinor.length > 0;
}

function mapOutboxRowToFinanceEvent(row: {
  tenantId: string;
  domainEventId: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}): FinanceWorkspaceOutboxEvent | null {
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

export function createWorkspaceOutboxReader(tenantId: string): FinanceWorkspaceOutboxReader {
  return {
    async readPending(): Promise<readonly FinanceWorkspaceOutboxEvent[]> {
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

      const events: FinanceWorkspaceOutboxEvent[] = [];
      for (const row of rows) {
        const mapped = mapOutboxRowToFinanceEvent(row);
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
