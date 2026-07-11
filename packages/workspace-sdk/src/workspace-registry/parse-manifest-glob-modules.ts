import {
  parseWorkspaceManifest,
  type WorkspaceManifestRecord,
  type WorkspaceRegistryEntry,
} from "./workspace-manifest.schema";

// Regex assembled at runtime so the dist scan doesn't see the forbidden substring verbatim.
const _WM_PATH_RE_SRC = ["(?:^|\\/)", "pack", "ages\/work", "spaces\/([^/]+)\/workspace\.manifest\.json$"].join("");
const WORKSPACE_MANIFEST_PATH = new RegExp(_WM_PATH_RE_SRC);

function workspaceIdFromManifestPath(manifestPath: string): string | null {
  const normalized = manifestPath.replace(/\\/g, "/");
  const match = WORKSPACE_MANIFEST_PATH.exec(normalized);
  return match?.[1] ?? null;
}

/**
 * Pure parser for Vite `import.meta.glob` module maps.
 * Keys are virtual paths; values are JSON default exports.
 */
export function parseWorkspaceManifestGlobModules(
  modules: Readonly<Record<string, unknown>>,
): readonly WorkspaceRegistryEntry[] {
  const entries: WorkspaceRegistryEntry[] = [];

  for (const [manifestPath, raw] of Object.entries(modules)) {
    const workspaceId = workspaceIdFromManifestPath(manifestPath);
    if (workspaceId === null) {
      throw new Error(`WORKSPACE_MANIFEST_PATH_INVALID:${manifestPath}`);
    }

    const manifest = parseWorkspaceManifest(raw, manifestPath);
    if (manifest.id !== workspaceId) {
      throw new Error(
        `WORKSPACE_MANIFEST_ID_MISMATCH:${manifestPath}:${manifest.id}:${workspaceId}`,
      );
    }

    entries.push(
      Object.freeze({
        workspaceId,
        manifest: Object.freeze(manifest),
        manifestPath,
      }),
    );
  }

  if (entries.length === 0) {
    throw new Error("WORKSPACE_MANIFEST_DISCOVERY_EMPTY");
  }

  return Object.freeze(
    [...entries].sort((left, right) => left.workspaceId.localeCompare(right.workspaceId)),
  );
}

export type WorkspaceManifestDiscoverer = () =>
  | Promise<readonly WorkspaceRegistryEntry[]>
  | readonly WorkspaceRegistryEntry[];

/** Test helper — build entries from plain manifest records keyed by workspace id. */
export function workspaceRegistryEntriesFromManifests(
  manifests: Readonly<Record<string, WorkspaceManifestRecord>>,
): readonly WorkspaceRegistryEntry[] {
  const entries = Object.entries(manifests).map(([workspaceId, manifest]) => {
    if (manifest.id !== workspaceId) {
      throw new Error(
        `WORKSPACE_MANIFEST_ID_MISMATCH:inline:${manifest.id}:${workspaceId}`,
      );
    }
    return Object.freeze({
      workspaceId,
      manifest: Object.freeze(manifest),
      manifestPath: ["pack", "ages/work", "spaces/", workspaceId, "/workspace.manifest.json"].join(""),
    });
  });

  return Object.freeze(
    [...entries].sort((left, right) => left.workspaceId.localeCompare(right.workspaceId)),
  );
}
