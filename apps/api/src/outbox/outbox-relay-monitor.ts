import { getOutboxRelayInFlightSnapshot } from "./outbox-relay-tenant-budget";

const DEFAULT_IN_FLIGHT_ALERT_TOTAL = 12;
const DEFAULT_IN_FLIGHT_ALERT_MAX_PER_TENANT = 3;

export function resolveOutboxRelayInFlightAlertTotal(): number {
  const raw = process.env.OUTBOX_RELAY_IN_FLIGHT_ALERT_TOTAL?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_IN_FLIGHT_ALERT_TOTAL;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_FLIGHT_ALERT_TOTAL;
  }
  return parsed;
}

export function resolveOutboxRelayInFlightAlertMaxPerTenant(): number {
  const raw = process.env.OUTBOX_RELAY_IN_FLIGHT_ALERT_MAX_PER_TENANT?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_IN_FLIGHT_ALERT_MAX_PER_TENANT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_FLIGHT_ALERT_MAX_PER_TENANT;
  }
  return parsed;
}

export function readOutboxRelayInFlightTotal(): number {
  return getOutboxRelayInFlightSnapshot().total;
}

export function readOutboxRelayInFlightMaxPerTenant(): number {
  return getOutboxRelayInFlightSnapshot().maxPerTenant;
}

export function readOutboxRelayTenantsActive(): number {
  return getOutboxRelayInFlightSnapshot().tenantsActive;
}
