export function readCanonicalValueAtDataPath(
  data: Record<string, unknown>,
  path: string
): unknown {
  const segments = path.split(".");
  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function canonicalValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left === undefined && right === undefined) {
    return true;
  }
  if (left === null && right === null) {
    return true;
  }
  if (typeof left === "number" && typeof right === "number") {
    return Object.is(left, right);
  }
  return JSON.stringify(left) === JSON.stringify(right);
}
