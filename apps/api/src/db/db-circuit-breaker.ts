import { metricsRegistry } from "../observability/metrics";
import { DbCircuitOpenError } from "./transient-db-error";

const FAILURE_THRESHOLD = 3;
const OPEN_MS = 30_000;

let consecutiveFailures = 0;
let circuitOpenUntilMs = 0;

function isDbCircuitBreakerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.DB_CIRCUIT_BREAKER_ENABLED?.trim().toLowerCase();
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  // Local dev over high-latency SSH tunnels (VPS infra) should not trip a process-wide open circuit.
  return env.NODE_ENV !== "development";
}

export function resetDbCircuitBreakerForTests(): void {
  consecutiveFailures = 0;
  circuitOpenUntilMs = 0;
}

export function isDbCircuitOpen(nowMs = Date.now()): boolean {
  if (!isDbCircuitBreakerEnabled()) {
    return false;
  }
  return nowMs < circuitOpenUntilMs;
}

export function assertDbCircuitClosed(nowMs = Date.now()): void {
  if (!isDbCircuitBreakerEnabled()) {
    return;
  }
  if (isDbCircuitOpen(nowMs)) {
    throw new DbCircuitOpenError(Math.ceil((circuitOpenUntilMs - nowMs) / 1000));
  }
}

export function recordDbTransientFailure(nowMs = Date.now()): void {
  if (!isDbCircuitBreakerEnabled()) {
    return;
  }
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
