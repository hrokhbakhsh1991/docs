import { metricsRegistry } from "../observability/metrics";
import { resolveTenantPriorityTier, type TenantPriorityTier } from "../tenant/tenant-priority-tier";

export const PRIORITY_LOAD_SHED = "PRIORITY_LOAD_SHED";

const DEFAULT_GLOBAL_HTTP_INFLIGHT_MAX = 64;
const DEFAULT_LOW_TIER_WATERMARK_RATIO = 0.6;
const DEFAULT_NORMAL_TIER_WATERMARK_RATIO = 0.9;
const DEFAULT_PRIORITY_LOAD_SHED_RETRY_AFTER_SEC = 2;

let globalHttpInflight = 0;

export class PriorityLoadShedError extends Error {
  readonly code = PRIORITY_LOAD_SHED;

  constructor(readonly retryAfterSec = resolvePriorityLoadShedRetryAfterSec()) {
    super(PRIORITY_LOAD_SHED);
    this.name = "PriorityLoadShedError";
  }
}

export function isPriorityLoadShedError(error: unknown): error is PriorityLoadShedError {
  return error instanceof PriorityLoadShedError;
}

export function isPriorityLoadShedEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PRIORITY_LOAD_SHED_ENABLED?.trim().toLowerCase() !== "false";
}

export function readGlobalHttpInflightMax(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.GLOBAL_HTTP_INFLIGHT_MAX?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_GLOBAL_HTTP_INFLIGHT_MAX;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(parsed, 10_000)
    : DEFAULT_GLOBAL_HTTP_INFLIGHT_MAX;
}

export function readLowTierShedWatermark(
  max = readGlobalHttpInflightMax(),
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.GLOBAL_HTTP_LOW_TIER_SHED_WATERMARK?.trim();
  if (raw !== undefined && raw.length > 0) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(parsed, max);
    }
  }
  return Math.max(1, Math.floor(max * DEFAULT_LOW_TIER_WATERMARK_RATIO));
}

export function readNormalTierShedWatermark(
  max = readGlobalHttpInflightMax(),
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.GLOBAL_HTTP_NORMAL_TIER_SHED_WATERMARK?.trim();
  if (raw !== undefined && raw.length > 0) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(parsed, max);
    }
  }
  return Math.max(1, Math.floor(max * DEFAULT_NORMAL_TIER_WATERMARK_RATIO));
}

export function resolvePriorityLoadShedRetryAfterSec(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PRIORITY_LOAD_SHED_RETRY_AFTER_SEC?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_PRIORITY_LOAD_SHED_RETRY_AFTER_SEC;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(parsed, 120)
    : DEFAULT_PRIORITY_LOAD_SHED_RETRY_AFTER_SEC;
}

function shouldShedForTier(
  tier: TenantPriorityTier,
  projectedInflight: number,
  max: number,
  lowWatermark: number,
  normalWatermark: number
): boolean {
  if (projectedInflight > max) {
    return true;
  }
  if (tier === "low" && projectedInflight > lowWatermark) {
    return true;
  }
  if (tier === "normal" && projectedInflight > normalWatermark) {
    return true;
  }
  return false;
}

/** Test-only — current global in-flight HTTP work admitted via weighted fair gate. */
export function getGlobalHttpInflightForTests(): number {
  return globalHttpInflight;
}

/** Test-only — reset admission counter between specs. */
export function resetWeightedFairAdmissionForTests(): void {
  globalHttpInflight = 0;
}

/**
 * Weighted fair admission — low tier sheds first under global inflight pressure (DEC-114).
 */
export async function acquireWeightedFairAdmission(tenantId: string): Promise<void> {
  if (!isPriorityLoadShedEnabled()) {
    return;
  }

  const max = readGlobalHttpInflightMax();
  const lowWatermark = readLowTierShedWatermark(max);
  const normalWatermark = readNormalTierShedWatermark(max);
  const tier = await resolveTenantPriorityTier(tenantId);
  const projected = globalHttpInflight + 1;

  if (shouldShedForTier(tier, projected, max, lowWatermark, normalWatermark)) {
    if (tier === "low") {
      metricsRegistry.increment("priority_load_shed_low_total");
    } else if (tier === "normal") {
      metricsRegistry.increment("priority_load_shed_normal_total");
    } else {
      metricsRegistry.increment("priority_load_shed_global_total");
    }
    throw new PriorityLoadShedError();
  }

  globalHttpInflight = projected;
}

export function releaseWeightedFairAdmission(): void {
  if (!isPriorityLoadShedEnabled()) {
    return;
  }
  globalHttpInflight = Math.max(0, globalHttpInflight - 1);
}
