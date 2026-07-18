/**
 * Boot wiring for Denali TourCreated finance side-effect deps (claim + outbox writer).
 * Imports the workspace package directly — never via platform outbox generated reexports
 * (Phase 1.9 Event Ownership Closure).
 */
import { registerTourCreatedFinanceSideEffectDeps } from "@app-tour/workspace-denali/host/finance/api-tour-created-adapter";

import { tryClaimWorkspaceFinanceProcessedEvent } from "./workspace-finance-processed-log";
import { createPrismaWorkspaceOutboxWriter } from "./prisma-workspace-outbox-writer";
import { logger } from "../observability/logger";

registerTourCreatedFinanceSideEffectDeps({
  tryClaimProcessedEvent: tryClaimWorkspaceFinanceProcessedEvent,
  createOutboxWriter: createPrismaWorkspaceOutboxWriter,
  logTourCreatedFailed: ({
    tenantId,
    domainEventId,
    message,
  }: {
    readonly tenantId: string;
    readonly domainEventId: string;
    readonly message: string;
  }) => {
    logger.warn({
      event: "workspace.finance.tour_created_failed",
      tenant_id: tenantId,
      domain_event_id: domainEventId,
      err: message,
    });
  },
});
