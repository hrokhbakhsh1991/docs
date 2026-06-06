import { metricsRegistry } from "../observability/metrics";
import { DbCircuitOpenError } from "./transient-db-error";

const FAILURE_THRESHOLD = 3;
const OPEN_MS = 30_000;

let consecutiveFailures = 0;
let circuitOpenUntilMs = 0;

export function resetDbCircuitBreakerForTests(): void {
  consecutiveFailures = 0;
  circuitOpenUntilMs = 0;
}

export function isDbCircuitOpen(nowMs = Date.now()): boolean {
  return nowMs < circuitOpenUntilMs;
}

export function assertDbCircuitClosed(nowMs = Date.now()): void {
  if (isDbCircuitOpen(nowMs)) {
    throw new DbCircuitOpenError(Math.ceil((circuitOpenUntilMs - nowMs) / 1000));
  }
}

export function recordDbTransientFailure(nowMs = Date.now()): void {
  consecutiveFailures += 1;
  metricsRegistry.increment("db_transient_error_total");
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntilMs = nowMs + OPEN_MS;
    consecutiveFailures = 0;
    metricsRegistry.increment("db_circuit_open_total");
  }
}

export function recordDbTransientSuccess(): void {
  consecutiveFailures = 0;
}
