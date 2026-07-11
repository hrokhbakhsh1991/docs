import fs from "node:fs/promises";
import path from "node:path";

import {
  workspaceRegistryEntriesFromManifests,
  type WorkspaceManifestDiscoverer,
} from "./parse-manifest-glob-modules";
import {
  parseWorkspaceManifest,
  type WorkspaceManifestRecord,
} from "./workspace-manifest.schema";

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export function resolveDefaultWorkspacesDir(): string {
  if (process.env.WORKSPACES_DIR !== undefined && process.env.WORKSPACES_DIR.trim().length > 0) {
    return path.resolve(process.env.WORKSPACES_DIR);
  }
  return path.resolve(process.cwd(), "../../packages/workspaces");
}

/**
 * Node/Next server discoverer — reads workspace.manifest.json under each workspace folder.
 */
export function createNodeWorkspaceManifestDiscoverer(
  workspacesDir: string = resolveDefaultWorkspacesDir(),
): WorkspaceManifestDiscoverer {
  return () => discoverWorkspaceManifestsFromDirectory(workspacesDir);
}

export async function discoverWorkspaceManifestsFromDirectory(workspacesDir: string) {
  try {
    await fs.access(workspacesDir);
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(`WORKSPACE_MANIFEST_DIR_MISSING:${workspacesDir}`);
    }
    throw error;
  }

  const dirEntries = await fs.readdir(workspacesDir, { withFileTypes: true });
  const workspaceIds = dirEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const discovered = await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const manifestPath = path.join(workspacesDir, workspaceId, "workspace.manifest.json");

      let raw: string;
      try {
        raw = await fs.readFile(manifestPath, "utf8");
      } catch (error) {
        if (isEnoent(error)) {
          return null;
        }
        throw error;
      }

      const parsed: unknown = JSON.parse(raw);
      const manifest = parseWorkspaceManifest(parsed, manifestPath);

      if (manifest.id !== workspaceId) {
        throw new Error(
          `WORKSPACE_MANIFEST_ID_MISMATCH:${manifestPath}:${manifest.id}:${workspaceId}`,
        );
      }

      return { workspaceId, manifest };
    }),
  );

  const manifests: Record<string, WorkspaceManifestRecord> = {};

  for (const item of discovered) {
    if (item === null) {
      continue;
    }

    const { workspaceId, manifest } = item;

    if (manifests[workspaceId] !== undefined) {
      throw new Error(`WORKSPACE_REGISTRY_DUPLICATE_ID:${workspaceId}`);
    }

    manifests[workspaceId] = manifest;
  }

  if (Object.keys(manifests).length === 0) {
    throw new Error(`WORKSPACE_MANIFEST_DISCOVERY_EMPTY:${workspacesDir}`);
  }

  return workspaceRegistryEntriesFromManifests(manifests);
}
