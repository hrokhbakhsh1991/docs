/** Plugin Contract paths — not prefixed with ./host (Phase 6 P2). */
export function isWorkspaceContractExportPath(entry) {
  if (entry === "." || entry === "./") return true;
  if (entry === "./plugin") return true;
  if (entry.startsWith("./theme/")) return true;
  if (entry.startsWith("./settings/")) return true;
  return false;
}

/**
 * Resolve package export to ESM import specifier.
 * Manifest-bound modules use `./host/*`; contract uses `./plugin`, `./theme/*`, `./settings/*`, or package root.
 * @param {string} pkg
 * @param {string} entry
 */
export function importSpecifier(pkg, entry) {
  if (entry === ".") return pkg;
  if (isWorkspaceContractExportPath(entry)) {
    if (entry.startsWith("./")) return `${pkg}/${entry.slice(2)}`;
    return `${pkg}/${entry}`;
  }
  if (entry.startsWith("./")) return `${pkg}/host/${entry.slice(2)}`;
  return `${pkg}/host/${entry}`;
}

/**
 * Default smoke-tenant module path per workspace id (devBootstrap codegen).
 * @param {string} workspaceId
 */
export function defaultSmokeTenantModule(workspaceId) {
  if (workspaceId === "denali") return "./smoke/phase-6-denali-smoke-tenant";
  if (workspaceId === "urban") return "./smoke/phase-7-urban-smoke-tenant";
  return "./smoke/tenant";
}

/**
 * Uppercase underscore prefix for generated const names (hyphen ids → GUEST_CLUB).
 * @param {string} workspaceId
 */
export function workspaceManifestConstPrefix(workspaceId) {
  return workspaceId.replace(/-/g, "_").toUpperCase();
}
