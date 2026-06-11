/**
 * Urban canonical PATCH merge — deep-merge root objects (Phase 10.4 P4-T06).
 */
export function mergeUrbanCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined
): T {
  if (patch === undefined) {
    return existing;
  }
  const merged: Record<string, unknown> = { ...existing };
  for (const [root, patchRoot] of Object.entries(patch)) {
    const existingRoot = merged[root];
    if (
      patchRoot !== null &&
      typeof patchRoot === "object" &&
      !Array.isArray(patchRoot) &&
      existingRoot !== null &&
      typeof existingRoot === "object" &&
      !Array.isArray(existingRoot)
    ) {
      merged[root] = { ...(existingRoot as Record<string, unknown>), ...patchRoot };
      continue;
    }
    merged[root] = patchRoot;
  }
  return merged as T;
}
