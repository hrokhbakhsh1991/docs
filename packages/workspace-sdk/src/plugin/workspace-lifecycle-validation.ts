import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";
import type { LifecycleGraphErrorCode } from "../errors/workspace-validation-errors.js";
import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";

/**
 * Validates lifecycle graph structure (acyclic, reachable publish, no orphans).
 */
export function validateLifecycleGraph(
  lifecycle: WorkspaceLifecycleContract,
): SdkResult<null, LifecycleGraphErrorCode> {
  const states = new Set<string>();
  states.add(lifecycle.initialStatus);
  states.add(lifecycle.publishStatus);

  const adjacency = new Map<string, string[]>();

  for (const transition of lifecycle.allowedTransitions) {
    states.add(transition.from);
    states.add(transition.to);
    const edges = adjacency.get(transition.from) ?? [];
    edges.push(transition.to);
    adjacency.set(transition.from, edges);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (node: string): LifecycleGraphErrorCode | null => {
    if (stack.has(node)) {
      return "CYCLE_DETECTED";
    }
    if (visited.has(node)) {
      return null;
    }
    visited.add(node);
    stack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      const cycle = dfs(next);
      if (cycle != null) {
        return cycle;
      }
    }
    stack.delete(node);
    return null;
  };

  for (const node of states) {
    const cycle = dfs(node);
    if (cycle != null) {
      return sdkErr(cycle, `Cycle detected at lifecycle state "${node}"`);
    }
  }

  const reachable = new Set<string>();
  const queue: string[] = [lifecycle.initialStatus];
  reachable.add(lifecycle.initialStatus);

  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const next of adjacency.get(node) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  if (!reachable.has(lifecycle.publishStatus)) {
    return sdkErr(
      "UNREACHABLE_PUBLISH",
      `publishStatus "${lifecycle.publishStatus}" is not reachable from initialStatus "${lifecycle.initialStatus}"`,
    );
  }

  for (const state of states) {
    if (state !== lifecycle.initialStatus && !reachable.has(state)) {
      return sdkErr("ORPHAN_STATE", `Orphan lifecycle state "${state}" is not reachable from initialStatus`);
    }
  }

  return sdkOk(null);
}

/** @deprecated Use {@link validateLifecycleGraph} (SdkResult). */
export function assertAcyclicLifecycleGraph(lifecycle: WorkspaceLifecycleContract): void {
  const result = validateLifecycleGraph(lifecycle);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
}
