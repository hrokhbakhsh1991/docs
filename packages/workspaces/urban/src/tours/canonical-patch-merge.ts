import { mergeWorkspaceCanonicalPatchData } from "@app-tour/workspace-sdk";

/**
 * Urban canonical PATCH merge — deep-merge root objects (Phase 10.4 P4-T06 / DG-1.2).
 */
export function mergeUrbanCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined,
): T {
  return mergeWorkspaceCanonicalPatchData(existing, patch, "deep-root");
}
