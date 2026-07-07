import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_WORKSPACES_DIR } from "./constants.mjs";

/**
 * Discover and validate workspace.manifest.json under packages/workspaces/.
 * @param {string} [workspacesDir]
 */
export function discoverManifests(workspacesDir = DEFAULT_WORKSPACES_DIR) {
  const manifests = [];
  for (const ent of readdirSync(workspacesDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const manifestPath = join(workspacesDir, ent.name, "workspace.manifest.json");
    if (!existsSync(manifestPath)) continue;
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const key of ["id", "version", "package", "workspaceTypes", "plugin"]) {
      if (raw[key] === undefined) {
        throw new Error(`${manifestPath}: missing required field "${key}"`);
      }
    }
    manifests.push(raw);
  }
  if (manifests.length === 0) {
    throw new Error(`No workspace.manifest.json found under ${workspacesDir}`);
  }
  return manifests.sort((a, b) => a.id.localeCompare(b.id));
}
