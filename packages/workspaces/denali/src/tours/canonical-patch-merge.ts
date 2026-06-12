/**
 * Denali canonical PATCH merge — shallow merge at root keys (Phase 12.3).
 * Wizard submit sends full canonical `data`; title-only patches may send partial roots.
 */
export function mergeDenaliCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined
): T {
  if (patch === undefined) {
    return existing;
  }
  return { ...existing, ...patch };
}
