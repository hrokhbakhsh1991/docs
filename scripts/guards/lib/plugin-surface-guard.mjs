/**
 * Shared plugin entry export surface rules for workspace packages.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectNamedExports(source) {
  /** @type {Set<string>} */
  const names = new Set();

  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+type\s+([A-Za-z0-9_]+)/g)) {
    names.add(match[1]);
  }
  for (const block of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    const clause = block[1] ?? "";
    for (const part of clause.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const exportName = trimmed.split(/\s+as\s+/i).pop()?.trim();
      if (exportName !== undefined && exportName.length > 0) {
        names.add(exportName);
      }
    }
  }

  return [...names];
}

/**
 * @param {string} exportName
 * @returns {boolean}
 */
export function isAllowedPluginSurfaceExport(exportName) {
  if (/^get[A-Za-z0-9]*WorkspacePlugin$/.test(exportName)) {
    return true;
  }
  if (/^create[A-Za-z0-9]*WorkspacePlugin$/.test(exportName)) {
    return true;
  }
  if (/_WORKSPACE_PLUGIN_ID$/.test(exportName)) {
    return true;
  }
  if (/_WORKSPACE_TYPE$/.test(exportName)) {
    return true;
  }
  if (/_THEME_(?:TOKENS|ADMIN)_STYLESHEET$/.test(exportName)) {
    return true;
  }
  if (exportName === "STARTER_THEME_TOKENS_STYLESHEET") {
    return true;
  }
  return false;
}

/**
 * @param {string} repoRoot
 * @param {{ id: string; package?: string; plugin?: { entry?: string } }} manifest
 * @returns {{ pluginFile: string; violations: string[] }}
 */
export function auditWorkspacePluginSurface(repoRoot, manifest) {
  const workspaceDir = path.join(repoRoot, "packages/workspaces", manifest.id);
  const pluginEntry = manifest.plugin?.entry ?? "./plugin";
  const entryBase = pluginEntry.replace(/^\.\//, "").replace(/\/$/, "");

  /** @type {string[]} */
  const candidates = [
    path.join(workspaceDir, "src", `${entryBase}.ts`),
    path.join(workspaceDir, "src", entryBase, "index.ts"),
    path.join(workspaceDir, "src", `${manifest.id}.plugin.ts`),
    path.join(workspaceDir, "src", "index.ts"),
  ];

  const pluginFile = candidates.find((candidate) => fs.existsSync(candidate));
  if (!pluginFile) {
    return {
      pluginFile: candidates[0],
      violations: [`${manifest.id}: plugin entry not found (${candidates.join(", ")})`],
    };
  }

  const rel = path.relative(repoRoot, pluginFile).replaceAll("\\", "/");
  const source = fs.readFileSync(pluginFile, "utf8");
  const exports = collectNamedExports(source);
  /** @type {string[]} */
  const violations = [];

  for (const exportName of exports) {
    if (!isAllowedPluginSurfaceExport(exportName)) {
      violations.push(`${rel}: disallowed export "${exportName}" on plugin surface`);
    }
  }

  const hasPluginGetter = exports.some((name) => /^get[A-Za-z0-9]*WorkspacePlugin$/.test(name));
  if (!hasPluginGetter) {
    violations.push(`${rel}: missing get*WorkspacePlugin export`);
  }

  return { pluginFile: rel, violations };
}
