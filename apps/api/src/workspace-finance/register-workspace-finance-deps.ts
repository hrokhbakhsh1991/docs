import { registerTourCreatedFinanceSideEffectDeps } from "../workspace/workspace-outbox-side-effects.generated.ts";

import { tryClaimWorkspaceFinanceProcessedEvent } from "./workspace-finance-processed-log";
import { createPrismaWorkspaceOutboxWriter } from "./prisma-workspace-outbox-writer";
import { logger } from "../observability/logger";

registerTourCreatedFinanceSideEffectDeps({
  tryClaimProcessedEvent: tryClaimWorkspaceFinanceProcessedEvent,
  createOutboxWriter: createPrismaWorkspaceOutboxWriter,
  logTourCreatedFailed: ({ tenantId, domainEventId, message }: { tenantId: string; domainEventId: string; message: string }) => {
    logger.warn({
      event: "workspace.finance.tour_created_failed",
      tenant_id: tenantId,
      domain_event_id: domainEventId,
      err: message,
    });
  },
});
