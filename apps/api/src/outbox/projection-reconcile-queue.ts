export type ProjectionReconcileTask = {
  readonly tenantId: string;
  readonly tourId?: string;
};

const pendingTasks: ProjectionReconcileTask[] = [];
const pendingKeys = new Set<string>();

function taskKey(task: ProjectionReconcileTask): string {
  return task.tourId !== undefined ? `${task.tenantId}:${task.tourId}` : task.tenantId;
}

/** Enqueue tenant/tour for background projection repair (DEC-115). */
export function enqueueProjectionAutoReconcile(tenantId: string, tourId?: string): void {
  const normalizedTenant = tenantId.trim();
  if (normalizedTenant.length === 0) {
    return;
  }
  const task: ProjectionReconcileTask = {
    tenantId: normalizedTenant,
    ...(tourId !== undefined && tourId.trim().length > 0 ? { tourId: tourId.trim() } : {}),
  };
  const key = taskKey(task);
  if (pendingKeys.has(key)) {
    return;
  }
  pendingKeys.add(key);
  pendingTasks.push(task);
}

/** Test-only — pending reconcile task count. */
export function getProjectionReconcileQueueDepthForTests(): number {
  return pendingTasks.length;
}

/** Test-only — reset queue between specs. */
export function resetProjectionReconcileQueueForTests(): void {
  pendingTasks.length = 0;
  pendingKeys.clear();
}

export function dequeueProjectionAutoReconcileBatch(maxItems: number): ProjectionReconcileTask[] {
  const limit = Math.max(1, Math.floor(maxItems));
  const batch = pendingTasks.splice(0, limit);
  for (const task of batch) {
    pendingKeys.delete(taskKey(task));
  }
  return batch;
}
