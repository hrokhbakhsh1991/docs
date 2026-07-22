/**
 * Platform-neutral path segment label (Wave F.a).
 * Canonical copy also lives in `@app-tour/workspace-sdk` (`labels/format-canonical-path-label`).
 * Web keeps a local implementation so Node tests resolve without a fresh sdk `dist`.
 */
export function formatCanonicalPathToLabel(canonicalPath: string): string {
  const segment = canonicalPath.split(".").pop() ?? canonicalPath;
  return segment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
