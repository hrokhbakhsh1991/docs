/**
 * Platform-neutral fallback label when no workspace message key resolves.
 * Product packages may re-export; hosts must not import this from a product package.
 */
export function formatCanonicalPathToLabel(canonicalPath: string): string {
  const segment = canonicalPath.split(".").pop() ?? canonicalPath;
  return segment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
