/** Neutral fallback label when no workspace label resolver is bound. */
export function formatCanonicalPathToLabel(canonicalPath: string): string {
  const segment = canonicalPath.split(".").pop() ?? canonicalPath;
  return segment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
