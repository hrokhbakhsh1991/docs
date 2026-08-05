/**
 * Phase I2 — workspace plugin load cache policy guard (pure / testable).
 * @see docs/dev/workspace-scale-hardening.mdoc
 */

/**
 * @param {string} generated
 * @param {number} expectedMaxEntries
 * @param {string} expectedRevision
 * @returns {string[]}
 */
export function collectWorkspacePluginLoadCacheViolations(
  generated,
  expectedMaxEntries,
  expectedRevision
) {
  /** @type {string[]} */
  const violations = [];

  if (/const pluginLoadCache\s*=\s*new Map/.test(generated)) {
    violations.push("generated loaders must not declare inline pluginLoadCache Map (use workspace-plugin-load-cache)");
  }
  if (!generated.includes('from "./workspace-plugin-load-cache"')) {
    violations.push("generated loaders must import workspace-plugin-load-cache");
  }
  if (!generated.includes("getOrCreateWorkspacePluginLoad")) {
    violations.push("generated loaders must call getOrCreateWorkspacePluginLoad");
  }
  if (!generated.includes("export { invalidateWorkspacePluginLoadCache }")) {
    violations.push("generated loaders must re-export invalidateWorkspacePluginLoadCache");
  }
  if (/SYNC_WORKSPACE_PLUGINS/.test(generated)) {
    violations.push("generated loaders must not define SYNC_WORKSPACE_PLUGINS (P4.1 / I3 async-only)");
  }
  if (/resolveSyncWorkspacePluginFromRegistry/.test(generated)) {
    violations.push("generated loaders must not export resolveSyncWorkspacePluginFromRegistry");
  }
  // Allow `import type` from workspace-sdk; forbid value imports of product packages.
  if (/^import (?!type\b).+from "@app-tour\/workspace-(?!sdk")/m.test(generated)) {
    violations.push(
      "generated loaders must not static-import @app-tour/workspace-* product packages (use dynamic import())"
    );
  }

  // Codegen may break the string onto the next line (prettier / long revision lists).
  const revisionMatch = generated.match(
    /export const WORKSPACE_PLUGIN_REGISTRY_REVISION\s*=\s*"([^"]*)"/
  );
  if (!revisionMatch) {
    violations.push("missing WORKSPACE_PLUGIN_REGISTRY_REVISION export");
  } else if (revisionMatch[1] !== expectedRevision) {
    violations.push(
      `WORKSPACE_PLUGIN_REGISTRY_REVISION mismatch (got ${revisionMatch[1]}, expected ${expectedRevision})`
    );
  }

  const maxMatch = generated.match(/export const WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES = (\d+)/);
  if (!maxMatch) {
    violations.push("missing WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES export");
  } else if (Number(maxMatch[1]) !== expectedMaxEntries) {
    violations.push(
      `WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES mismatch (got ${maxMatch[1]}, expected ${expectedMaxEntries})`
    );
  }

  return violations;
}
