/**
 * Workspace type → TourCreated finance event reaction (Phase 1.10).
 * Adapter classes come from generated manifest bindings; Prisma outbox IO stays platform-owned.
 * Resolve is fail-closed: unregistered workspace types throw (no silent no-op).
 */

import type { DenaliOutboxDomainEvent, OutboxReader, OutboxWriter } from "@app-tour/workspace-denali";

import {
  isFinanceEventReactionBindingRegistered,
  WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS,
} from "./workspace-finance-event-reaction-bindings.generated";
import type { WorkspaceFinanceEventReactionPort } from "./ports/workspace-finance-event-reaction.port";
import { createWorkspaceOutboxReader } from "./prisma-workspace-outbox-reader";
import { createPrismaWorkspaceOutboxWriter } from "./prisma-workspace-outbox-writer";
import { createWorkspaceFinanceProcessedStore } from "./workspace-finance-processed-log";

function createPlatformTourCreatedFinanceHostIo(): {
  readonly createOutboxReader: (tenantId: string) => OutboxReader;
  readonly createOutboxWriter: () => OutboxWriter;
  readonly createProcessedStore: (tenantId: string) => ReturnType<
    typeof createWorkspaceFinanceProcessedStore
  >;
} {
  return {
    createOutboxReader(tenantId: string): OutboxReader {
      const reader = createWorkspaceOutboxReader(tenantId);
      return {
        async readPending(): Promise<readonly DenaliOutboxDomainEvent[]> {
          const rows = await reader.readPending();
          return rows.map((row) => ({
            tenantId: row.tenantId,
            domainEventId: row.domainEventId,
            eventType: row.eventType,
            aggregateType: row.aggregateType,
            aggregateId: row.aggregateId,
            payload: row.payload,
          }));
        },
      };
    },
    createOutboxWriter(): OutboxWriter {
      return createPrismaWorkspaceOutboxWriter() as OutboxWriter;
    },
    createProcessedStore(tenantId: string) {
      return createWorkspaceFinanceProcessedStore(tenantId);
    },
  };
}

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

/** True when a workspace type has a registered TourCreated → finance reaction adapter. */
export function isWorkspaceFinanceEventReactionRegistered(workspaceType: string): boolean {
  const normalized = normalizeWorkspaceType(workspaceType);
  return normalized.length > 0 && isFinanceEventReactionBindingRegistered(normalized);
}

/**
 * Resolve workspace finance event reaction capability.
 * @throws `FINANCE_EVENT_REACTION_UNSUPPORTED` when workspaceType is not registered.
 */
export function resolveWorkspaceFinanceEventReaction(
  workspaceType: string
): WorkspaceFinanceEventReactionPort {
  const normalized = normalizeWorkspaceType(workspaceType);
  if (normalized.length === 0) {
    throw new Error(
      "FINANCE_EVENT_REACTION_UNSUPPORTED: workspaceType is required to resolve finance event reaction"
    );
  }
  const binding =
    WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS[
      normalized as keyof typeof WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS
    ];
  if (binding === undefined) {
    throw new Error(
      `FINANCE_EVENT_REACTION_UNSUPPORTED: no finance event reaction for workspaceType=${workspaceType}`
    );
  }
  if (binding.requiresHostIo === true) {
    return binding.create(createPlatformTourCreatedFinanceHostIo());
  }
  return binding.create();
}
