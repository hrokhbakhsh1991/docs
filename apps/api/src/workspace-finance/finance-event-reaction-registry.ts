/**
 * Workspace type → TourCreated finance event reaction (Phase 1.9 Event Ownership Closure).
 * Adapter classes come from generated manifest bindings; Prisma outbox IO stays platform-owned.
 * Resolve is fail-closed: unregistered workspace types throw (no silent no-op).
 * Host IO types are platform ports — no workspace package type imports.
 */

import {
  isFinanceEventReactionBindingRegistered,
  WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS,
} from "./workspace-finance-event-reaction-bindings.generated";
import type { FinanceOutboxWriter } from "./ports/finance-outbox-writer.port";
import type {
  FinanceWorkspaceOutboxReader,
} from "./ports/finance-workspace-outbox-reader.port";
import type { WorkspaceFinanceEventReactionPort } from "./ports/workspace-finance-event-reaction.port";
import { createWorkspaceOutboxReader } from "./prisma-workspace-outbox-reader";
import { createPrismaWorkspaceOutboxWriter } from "./prisma-workspace-outbox-writer";
import { createWorkspaceFinanceProcessedStore } from "./workspace-finance-processed-log";

/** Platform host IO for workspace reaction adapters that declare `requiresHostIo: true`. */
export type PlatformTourCreatedFinanceHostIo = {
  readonly createOutboxReader: (tenantId: string) => FinanceWorkspaceOutboxReader;
  readonly createOutboxWriter: () => FinanceOutboxWriter;
  readonly createProcessedStore: (tenantId: string) => ReturnType<
    typeof createWorkspaceFinanceProcessedStore
  >;
};

function createPlatformTourCreatedFinanceHostIo(): PlatformTourCreatedFinanceHostIo {
  return {
    createOutboxReader(tenantId: string): FinanceWorkspaceOutboxReader {
      return createWorkspaceOutboxReader(tenantId);
    },
    createOutboxWriter(): FinanceOutboxWriter {
      return createPrismaWorkspaceOutboxWriter();
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
    // Structural: workspace HostIo ports accept platform reader/writer shapes.
    return binding.create(createPlatformTourCreatedFinanceHostIo() as never);
  }
  return binding.create();
}
