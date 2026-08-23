import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_WORKSPACES_DIR } from "./constants.mjs";
import { applyProfileExpansion } from "./domains/profile-expansion.mjs";

/**
 * Discover author workspace.manifest.json under packages/workspaces/ (pre-profile expansion).
 * @param {string} [workspacesDir]
 */
export function discoverAuthorManifests(workspacesDir = DEFAULT_WORKSPACES_DIR) {
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

/**
 * Discover effective manifests — profile expansion applied before codegen (CW6-02).
 * @param {string} [workspacesDir]
 */
export function discoverManifests(workspacesDir = DEFAULT_WORKSPACES_DIR) {
  return applyProfileExpansion(discoverAuthorManifests(workspacesDir));
}
