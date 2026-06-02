/**
 * Dot-path read/write helpers for plain object form values (UI-agnostic).
 */

export function readFormPath(values: unknown, path: string): unknown {
  if (values == null || path === "") return undefined;
  const segments = path.split(".").filter(Boolean);
  let current: unknown = values;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function writeFormPath<T extends Record<string, unknown>>(
  values: T,
  path: string,
  value: unknown,
): T {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return values;

  const root = { ...values } as Record<string, unknown>;
  let current = root;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]!;
    const next = current[key];
    const branch =
      next != null && typeof next === "object" && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : {};
    current[key] = branch;
    current = branch;
  }

  current[segments[segments.length - 1]!] = value;
  return root as T;
}

/** Stable JSON key for dependency snapshots (lookup cache invalidation). */
export function snapshotFormValues(
  values: unknown,
  dependencyPaths: readonly string[],
): string {
  const bag: Record<string, unknown> = {};
  for (const path of dependencyPaths) {
    bag[path] = readFormPath(values, path);
  }
  return JSON.stringify(bag);
}
