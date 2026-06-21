/** Platform draft tombstone binding — workspace plugins implement; API resolves via WorkspacePlugin. */

export type WorkspaceDraftTombstoneBinding = {
  resolveTombstoneRoots(
    baselineForm: Readonly<Record<string, unknown>>,
    incomingForm: Readonly<Record<string, unknown>>,
  ): readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyRootValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

/**
 * Top-level roots removed between baseline and incoming form.
 * Plugins pass their eligible root key set — platform code must not hardcode workspace roots.
 */
export function topLevelRootsRemoved(
  baseline: Readonly<Record<string, unknown>>,
  incoming: Readonly<Record<string, unknown>>,
  roots: ReadonlySet<string>,
): readonly string[] {
  const tombstones: string[] = [];

  for (const rootKey of roots) {
    if (
      rootKey in baseline &&
      isNonEmptyRootValue(baseline[rootKey]) &&
      !(rootKey in incoming)
    ) {
      tombstones.push(rootKey);
    }
  }

  if (tombstones.length === 0) {
    return [];
  }
  return [...tombstones].sort();
}

/** Starter / workspaces without tombstone-eligible object roots. */
export const noopWorkspaceDraftTombstoneBinding: WorkspaceDraftTombstoneBinding = {
  resolveTombstoneRoots: () => [],
};
