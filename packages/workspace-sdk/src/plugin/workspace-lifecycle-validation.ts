import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";

/**
 * Returns an error message when the lifecycle graph is invalid; otherwise null.
 */
export function validateLifecycleGraph(
  lifecycle: WorkspaceLifecycleContract,
): string | null {
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

  const dfs = (node: string): string | null => {
    if (stack.has(node)) {
      return `Cycle detected at lifecycle state "${node}"`;
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
      return cycle;
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
    return `publishStatus "${lifecycle.publishStatus}" is not reachable from initialStatus "${lifecycle.initialStatus}"`;
  }

  for (const state of states) {
    if (state !== lifecycle.initialStatus && !reachable.has(state)) {
      return `Orphan lifecycle state "${state}" is not reachable from initialStatus`;
    }
  }

  return null;
}

export function assertAcyclicLifecycleGraph(lifecycle: WorkspaceLifecycleContract): void {
  const message = validateLifecycleGraph(lifecycle);
  if (message != null) {
    throw new Error(message);
  }
}
