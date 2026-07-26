/**
 * Workspace type → TourCreated finance event reaction (Phase 1.13).
 * Adapter classes come from generated manifest bindings; Prisma outbox IO stays platform-owned.
 * Resolve is fail-closed: unregistered workspace types throw (no silent no-op).
 * Host IO types are platform ports — no workspace package type imports.
 */

import { logger } from "../observability/logger";
import { metricsRegistry } from "../observability/metrics";
import { resolveFinanceWorkspaceTypeForTenant } from "./resolve-finance-workspace-type-for-tenant";
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
import { createPrismaWorkspaceOutboxWriter } from "./infrastructure/prisma-workspace-outbox-writer";
import { emitTourCreatedPaidLedgerExclusive } from "./tour-created-paid-ledger-exclusive";
import {
  createWorkspaceFinanceProcessedStore,
  tryClaimWorkspaceFinanceProcessedEvent,
} from "./workspace-finance-processed-log";

/** Must match `FINANCE_METRIC.reactionFailed` in finance-core. */
const FINANCE_REACTION_FAILED_TOTAL = "finance_reaction_failed_total";

/** Platform host IO for workspace reaction adapters that declare `requiresHostIo: true`. */
export type PlatformFinanceEventReactionHostIo = {
  readonly createOutboxReader: (tenantId: string) => FinanceWorkspaceOutboxReader;
  readonly createOutboxWriter: () => FinanceOutboxWriter;
  readonly createProcessedStore: (tenantId: string) => ReturnType<
    typeof createWorkspaceFinanceProcessedStore
  >;
  readonly tryClaimProcessedEvent: (
    tenantId: string,
    domainEventId: string
  ) => Promise<boolean>;
  readonly logReactionFailed: (input: {
    readonly tenantId: string;
    readonly domainEventId: string;
    readonly message: string;
  }) => void;
  readonly emitTourCreatedPaidLedgerExclusive: (input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paidAmountMinor: string;
    readonly currency: string;
    readonly tourCreatedDomainEventId: string;
  }) => Promise<"emitted" | "skipped">;
};

function createPlatformFinanceEventReactionHostIo(): PlatformFinanceEventReactionHostIo {
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
    tryClaimProcessedEvent: tryClaimWorkspaceFinanceProcessedEvent,
    emitTourCreatedPaidLedgerExclusive,
    logReactionFailed({ tenantId, domainEventId, message }) {
      logger.warn({
        event: "workspace.finance.tour_created_failed",
        tenant_id: tenantId,
        domain_event_id: domainEventId,
        err: message,
      });
      void resolveFinanceWorkspaceTypeForTenant(tenantId)
        .then((workspaceType) => {
          metricsRegistry.increment(FINANCE_REACTION_FAILED_TOTAL, {
            tenant_id: tenantId,
            workspace_type: workspaceType,
          });
        })
        .catch(() => {
          metricsRegistry.increment(FINANCE_REACTION_FAILED_TOTAL, {
            tenant_id: tenantId,
            workspace_type: "unknown",
          });
        });
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
 * Resolve workspace finance event reaction capability (P4-D3.b — async dynamic import).
 * @throws `FINANCE_EVENT_REACTION_UNSUPPORTED` when workspaceType is not registered.
 */
export async function resolveWorkspaceFinanceEventReaction(
  workspaceType: string
): Promise<WorkspaceFinanceEventReactionPort> {
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
    // Structural: workspace HostIo ports accept platform reader/writer/claim shapes.
    return binding.create(createPlatformFinanceEventReactionHostIo() as never);
  }
  return binding.create();
}
