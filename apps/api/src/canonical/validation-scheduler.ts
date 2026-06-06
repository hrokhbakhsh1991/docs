import { runWithTenantContext } from "../tenant/tenant-request-context";
import { metricsRegistry } from "../observability/metrics";
import { ValidationQueueSaturatedError } from "./validation-queue-saturated";

type ScheduledTask<T> = {
  readonly tenantId: string;
  readonly run: () => T;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
};

const tenantQueues = new Map<string, ScheduledTask<unknown>[]>();
const tenantsWithWork: string[] = [];
let activeCount = 0;
const inFlightPerTenant = new Map<string, number>();

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MAX_IN_FLIGHT_PER_TENANT = 2;
const DEFAULT_QUEUE_YIELD_DEPTH = 32;
const DEFAULT_MAX_QUEUE_DEPTH_PER_TENANT = 64;

function readMaxConcurrent(): number {
  const raw = process.env.P5_VALIDATION_MAX_CONCURRENT?.trim();
  if (!raw) {
    return DEFAULT_MAX_CONCURRENT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_CONCURRENT;
}

function readQueueYieldDepth(): number {
  const raw = process.env.P5_VALIDATION_QUEUE_YIELD_DEPTH?.trim();
  if (!raw) {
    return DEFAULT_QUEUE_YIELD_DEPTH;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_QUEUE_YIELD_DEPTH;
}

function readMaxInFlightPerTenant(): number {
  const raw = process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT?.trim();
  if (!raw) {
    return DEFAULT_MAX_IN_FLIGHT_PER_TENANT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_IN_FLIGHT_PER_TENANT;
}

function readMaxQueueDepthPerTenant(): number {
  const raw = process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT?.trim();
  if (!raw) {
    return DEFAULT_MAX_QUEUE_DEPTH_PER_TENANT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_QUEUE_DEPTH_PER_TENANT;
}

function recordValidationQueueShed(tenantId: string): void {
  metricsRegistry.increment("validation_queue_shed_total", { tenant_id: tenantId });
}

function enqueueTenant(tenantId: string): void {
  if (!tenantQueues.has(tenantId)) {
    tenantQueues.set(tenantId, []);
    tenantsWithWork.push(tenantId);
  }
}

/** Prefer tenants with the shortest queue among those under per-tenant in-flight cap. */
function pickTenantWithShortestQueue(): string | undefined {
  if (tenantsWithWork.length === 0) {
    return undefined;
  }
  const maxInFlight = readMaxInFlightPerTenant();
  let picked: string | undefined;
  let shortest = Number.POSITIVE_INFINITY;
  for (const tenantId of tenantsWithWork) {
    const depth = tenantQueues.get(tenantId)?.length ?? 0;
    const inFlight = inFlightPerTenant.get(tenantId) ?? 0;
    if (depth > 0 && inFlight < maxInFlight && depth < shortest) {
      shortest = depth;
      picked = tenantId;
    }
  }
  return picked;
}

function dequeueTask(): ScheduledTask<unknown> | undefined {
  const tenantId = pickTenantWithShortestQueue();
  if (!tenantId) {
    return undefined;
  }
  const queue = tenantQueues.get(tenantId);
  if (!queue || queue.length === 0) {
    return undefined;
  }
  const task = queue.shift()!;
  if (queue.length === 0) {
    tenantQueues.delete(tenantId);
    const idx = tenantsWithWork.indexOf(tenantId);
    if (idx >= 0) {
      tenantsWithWork.splice(idx, 1);
    }
  }
  return task;
}

function pumpQueue(): void {
  const maxConcurrent = readMaxConcurrent();
  while (activeCount < maxConcurrent) {
    const task = dequeueTask();
    if (!task) {
      return;
    }
    activeCount += 1;
    inFlightPerTenant.set(task.tenantId, (inFlightPerTenant.get(task.tenantId) ?? 0) + 1);
    const remainingDepth = tenantQueues.get(task.tenantId)?.length ?? 0;
    const shouldYieldForDeepQueue = remainingDepth >= readQueueYieldDepth();
    void Promise.resolve()
      .then(async () => {
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
        if (shouldYieldForDeepQueue) {
          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });
        }
      })
      .then(() => runWithTenantContext(task.tenantId, async () => task.run()))
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        activeCount -= 1;
        const current = inFlightPerTenant.get(task.tenantId) ?? 1;
        if (current <= 1) {
          inFlightPerTenant.delete(task.tenantId);
        } else {
          inFlightPerTenant.set(task.tenantId, current - 1);
        }
        pumpQueue();
      });
  }
}

/**
 * Fair validation scheduler — caps concurrent CPU-heavy validation and round-robins tenants.
 * @see docs/phase-5/appendices/validation-fairness.md (DEC-016)
 */
export function runScheduledValidation<T>(tenantId: string, run: () => T): Promise<T> {
  const normalized = tenantId.trim();
  return new Promise<T>((resolve, reject) => {
    const pendingDepth = tenantQueues.get(normalized)?.length ?? 0;
    const maxDepth = readMaxQueueDepthPerTenant();
    if (pendingDepth >= maxDepth) {
      recordValidationQueueShed(normalized);
      reject(new ValidationQueueSaturatedError(maxDepth));
      return;
    }

    enqueueTenant(normalized);
    const queue = tenantQueues.get(normalized)!;
    queue.push({
      tenantId: normalized,
      run,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    pumpQueue();
  });
}

/** Test-only — pending task count for a tenant (excludes in-flight). */
export function getValidationQueueDepthForTests(tenantId: string): number {
  return tenantQueues.get(tenantId.trim())?.length ?? 0;
}

/** Validations currently executing (DEC-108 / B2 monitor). */
export function getValidationInFlightTotal(): number {
  return activeCount;
}

/** Pending validation tasks snapshot for metrics (DEC-108). */
export function getValidationQueueDepthSnapshot(): {
  readonly total: number;
  readonly perTenant: ReadonlyMap<string, number>;
} {
  let total = 0;
  const perTenant = new Map<string, number>();
  for (const [tenantId, queue] of tenantQueues) {
    const depth = queue.length;
    if (depth > 0) {
      perTenant.set(tenantId, depth);
      total += depth;
    }
  }
  return { total, perTenant };
}

/** Test-only — reset scheduler between isolated cases. */
export function resetValidationSchedulerForTests(): void {
  tenantQueues.clear();
  tenantsWithWork.length = 0;
  activeCount = 0;
  inFlightPerTenant.clear();
}
