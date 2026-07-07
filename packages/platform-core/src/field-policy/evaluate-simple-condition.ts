import type { FieldPolicyEntityState } from "./entity-state";
import type { SimpleCondition } from "./types";

function readPathValue(
  state: Readonly<Record<string, unknown>>,
  path: string,
): { readonly exists: boolean; readonly value: unknown } {
  const parts = path.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { exists: false, value: undefined };
  }

  let current: unknown = state;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return { exists: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[part];
  }

  return { exists: true, value: current };
}

export function evaluateSimpleCondition(
  condition: SimpleCondition | undefined,
  entityState: FieldPolicyEntityState,
): boolean {
  if (condition == null || condition.kind === "always") {
    return true;
  }

  const resolved = readPathValue(entityState, condition.path);

  if (condition.kind === "exists") {
    return resolved.exists;
  }

  return resolved.exists && resolved.value === condition.value;
}
