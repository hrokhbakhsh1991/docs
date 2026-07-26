/** Read a nested string from a plain object tree (dotted path). */
export function getNestedStringValue(
  root: Record<string, unknown> | undefined,
  path: string
): string | undefined {
  if (root === undefined) {
    return undefined;
  }
  const parts = path.split(".");
  let cursor: unknown = root;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "string" ? cursor : undefined;
}
