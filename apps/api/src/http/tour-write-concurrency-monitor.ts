import { getTourWriteInFlightSnapshot } from "./tour-write-concurrency-budget";

const DEFAULT_IN_FLIGHT_ALERT_TOTAL = 20;
const DEFAULT_IN_FLIGHT_ALERT_MAX_PER_TENANT = 6;

export function resolveTourWriteInFlightAlertTotal(): number {
  const raw = process.env.TOUR_WRITE_IN_FLIGHT_ALERT_TOTAL?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_IN_FLIGHT_ALERT_TOTAL;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_FLIGHT_ALERT_TOTAL;
  }
  return parsed;
}

export function resolveTourWriteInFlightAlertMaxPerTenant(): number {
  const raw = process.env.TOUR_WRITE_IN_FLIGHT_ALERT_MAX_PER_TENANT?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_IN_FLIGHT_ALERT_MAX_PER_TENANT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_FLIGHT_ALERT_MAX_PER_TENANT;
  }
  return parsed;
}

export function readTourWriteInFlightTotal(): number {
  return getTourWriteInFlightSnapshot().total;
}

export function readTourWriteInFlightMaxPerTenant(): number {
  return getTourWriteInFlightSnapshot().maxPerTenant;
}

export function readTourWriteTenantsActive(): number {
  return getTourWriteInFlightSnapshot().tenantsActive;
}
