import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveDefaultWorkspacesDir } from "./node-manifest-discoverer";

/**
 * Stable aggregate fingerprint of all workspace.manifest.json files on disk.
 * Used to detect manifest drift without process restart (REM-007 / RT-01).
 */
export async function computeWorkspaceManifestFingerprint(
  workspacesDir: string = resolveDefaultWorkspacesDir(),
): Promise<string> {
  let dirEntries: Array<{ name: string; isDirectory: () => boolean }>;
  try {
    dirEntries = await fs.readdir(workspacesDir, { withFileTypes: true });
  } catch {
    return createHash("sha256").update("WORKSPACE_MANIFEST_DIR_MISSING").digest("hex");
  }

  const workspaceIds = dirEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const hash = createHash("sha256");
  for (const workspaceId of workspaceIds) {
    const manifestPath = path.join(workspacesDir, workspaceId, "workspace.manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      hash.update(`${workspaceId}\0${raw}\0`);
    } catch {
      // Workspace folder without manifest — skip (same as discoverer).
    }
  }

  return hash.digest("hex");
}
