import { mergeWorkspaceCanonicalPatchData } from "@app-tour/workspace-sdk";

/**
 * Denali canonical PATCH merge — shallow merge at root keys (Phase 12.3 / DG-1.2).
 * Wizard submit sends full canonical `data`; title-only patches may send partial roots.
 */
export function mergeDenaliCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined,
): T {
  return mergeWorkspaceCanonicalPatchData(existing, patch, "shallow");
}
