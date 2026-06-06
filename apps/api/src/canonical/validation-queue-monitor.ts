import {
  getValidationInFlightTotal,
  getValidationQueueDepthSnapshot,
} from "./validation-scheduler";

const DEFAULT_DEPTH_ALERT_TOTAL = 200;
const DEFAULT_DEPTH_ALERT_MAX_PER_TENANT = 50;

export function resolveValidationQueueDepthAlertTotal(): number {
  const raw = process.env.VALIDATION_QUEUE_DEPTH_ALERT_TOTAL?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_DEPTH_ALERT_TOTAL;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_DEPTH_ALERT_TOTAL;
  }
  return parsed;
}

export function resolveValidationQueueDepthAlertMaxPerTenant(): number {
  const raw = process.env.VALIDATION_QUEUE_DEPTH_ALERT_MAX_PER_TENANT?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_DEPTH_ALERT_MAX_PER_TENANT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_DEPTH_ALERT_MAX_PER_TENANT;
  }
  return parsed;
}

export function readValidationQueueDepthTotal(): number {
  return getValidationQueueDepthSnapshot().total;
}

export function readValidationQueueDepthMaxPerTenant(): number {
  const { perTenant } = getValidationQueueDepthSnapshot();
  let maxDepth = 0;
  for (const depth of perTenant.values()) {
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }
  return maxDepth;
}

export function readValidationQueueTenantsPending(): number {
  return getValidationQueueDepthSnapshot().perTenant.size;
}

export function readValidationQueueInFlightTotal(): number {
  return getValidationInFlightTotal();
}
