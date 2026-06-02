import type { DraftMergeResult, DraftSnapshot } from "@repo/shared-contracts";

export const DRAFT_CONFLICT_RESOLVER_PORT = Symbol("DRAFT_CONFLICT_RESOLVER_PORT");

export interface DraftConflictResolverPort {
  resolveMergeConflict(
    clientDraft: DraftSnapshot,
    serverDraft: DraftSnapshot
  ): DraftMergeResult;
}
