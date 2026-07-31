export type WorkspaceCanonicalPatchMergeStrategy = "shallow" | "deep-root";

/**
 * Shared canonical PATCH merge (DG-1.2).
 * - `shallow`: replace/assign root keys only.
 * - `deep-root`: shallow-merge object roots one level.
 */
export function mergeWorkspaceCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined,
  strategy: WorkspaceCanonicalPatchMergeStrategy = "shallow",
): T {
  if (patch === undefined) {
    return existing;
  }

  if (strategy === "shallow") {
    return { ...existing, ...patch };
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
      merged[root] = {
        ...(existingRoot as Record<string, unknown>),
        ...(patchRoot as Record<string, unknown>),
      };
      continue;
    }
    merged[root] = patchRoot;
  }
  return merged as T;
}
