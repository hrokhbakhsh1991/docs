export type CanonicalPatchData = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Generic root-level shallow canonical PATCH merge.
 * Workspace-specific mergers (Denali/Urban/Harbor) remain manifest-bound adapters.
 */
export function mergeShallowCanonicalPatchData(
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined,
): CanonicalPatchData {
  if (patch === undefined) {
    return existing;
  }
  const next: CanonicalPatchData = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(value) && isRecord(existing[key])) {
      next[key] = { ...(existing[key] as Record<string, unknown>), ...value };
    } else {
      next[key] = value;
    }
  }
  return next;
}
