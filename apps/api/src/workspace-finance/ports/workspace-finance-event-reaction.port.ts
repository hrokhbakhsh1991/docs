/**
 * Compatibility re-export — SoT: `@app-tour/finance-http-contracts` (Phase 2.3.1).
 * Reaction ports are host/workspace concerns — not finance-core application ports.
 */
export type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";
