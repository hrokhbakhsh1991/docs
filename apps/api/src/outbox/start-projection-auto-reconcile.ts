import { logger } from "../observability/logger";
import {
  dequeueProjectionAutoReconcileBatch,
  type ProjectionReconcileTask,
} from "./projection-reconcile-queue";
import {
  reconcileTourProjectionsForTenant,
  repairTourProjectionIfDrifted,
} from "./reconcile-tour-projection";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 10;

export type ProjectionAutoReconcileHandle = {
  readonly stop: () => void;
};

export function isProjectionAutoReconcileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.PROJECTION_AUTO_RECONCILE_ENABLED?.trim().toLowerCase();
  if (raw === "false") {
    return false;
  }
  if (raw === "true") {
    return true;
  }
  return env.STORAGE_DRIVER?.trim() === "prisma" && Boolean(env.DATABASE_URL?.trim());
}

export function readProjectionAutoReconcileIntervalMs(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.PROJECTION_AUTO_RECONCILE_INTERVAL_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_INTERVAL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : DEFAULT_INTERVAL_MS;
}

export function readProjectionAutoReconcileBatchSize(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PROJECTION_AUTO_RECONCILE_BATCH_SIZE?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_BATCH_SIZE;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 100) : DEFAULT_BATCH_SIZE;
}

async function processProjectionReconcileTask(task: ProjectionReconcileTask): Promise<void> {
  if (task.tourId !== undefined) {
    await repairTourProjectionIfDrifted(task.tenantId, task.tourId);
    return;
  }
  await reconcileTourProjectionsForTenant(task.tenantId, 100, { repair: true });
}

/** Drain queued projection repair tasks once (DEC-115). */
export async function processProjectionAutoReconcileOnce(
  batchSize = readProjectionAutoReconcileBatchSize()
): Promise<{ readonly processed: number }> {
  const tasks = dequeueProjectionAutoReconcileBatch(batchSize);
  for (const task of tasks) {
    await processProjectionReconcileTask(task);
  }
  return { processed: tasks.length };
}

/**
 * Starts background projection auto-reconcile when enabled (DEC-115).
 */
export function startProjectionAutoReconcileIfEnabled(): ProjectionAutoReconcileHandle {
  if (!isProjectionAutoReconcileEnabled()) {
    return { stop: () => {} };
  }

  const intervalMs = readProjectionAutoReconcileIntervalMs();
  let stopped = false;

  const tick = (): void => {
    if (stopped) {
      return;
    }
    void processProjectionAutoReconcileOnce()
      .then((result) => {
        if (result.processed > 0) {
          logger.info(
            { event: "projection.auto_reconcile.tick", processed: result.processed },
            "projection auto-reconcile tick"
          );
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          { event: "projection.auto_reconcile.error", error: message },
          "projection auto-reconcile tick failed"
        );
      });
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();

  logger.info(
    { event: "projection.auto_reconcile.start", intervalMs },
    "projection auto-reconcile scheduler started"
  );

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
