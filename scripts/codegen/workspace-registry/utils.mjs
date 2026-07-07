/**
 * Resolve package export to ESM import specifier.
 * @param {string} pkg
 * @param {string} entry
 */
export function importSpecifier(pkg, entry) {
  if (entry === ".") return pkg;
  if (entry.startsWith("./")) return `${pkg}/${entry.slice(2)}`;
  return `${pkg}/${entry}`;
}

/**
 * Uppercase underscore prefix for generated const names (hyphen ids → GUEST_CLUB).
 * @param {string} workspaceId
 */
export function workspaceManifestConstPrefix(workspaceId) {
  return workspaceId.replace(/-/g, "_").toUpperCase();
}
