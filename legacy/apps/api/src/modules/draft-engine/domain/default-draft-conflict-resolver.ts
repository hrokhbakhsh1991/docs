import type { DraftMergeResult, DraftSnapshot } from "@repo/shared-contracts";
import { deterministicDraftMerge } from "./deterministic-draft-merge";
import type { DraftConflictResolverPort } from "./ports/draft-conflict-resolver.port";

export class DefaultDraftConflictResolver implements DraftConflictResolverPort {
  resolveMergeConflict(clientDraft: DraftSnapshot, serverDraft: DraftSnapshot): DraftMergeResult {
    return deterministicDraftMerge(clientDraft, serverDraft);
  }
}
