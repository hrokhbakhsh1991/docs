/**
 * Global HTTP in-flight counter for Prometheus / HPA (DEC-121).
 */

let httpRequestsInFlight = 0;

export function incrementHttpRequestsInFlight(): void {
  httpRequestsInFlight += 1;
}

export function decrementHttpRequestsInFlight(): void {
  httpRequestsInFlight = Math.max(0, httpRequestsInFlight - 1);
}

export function readHttpRequestsInFlight(): number {
  return httpRequestsInFlight;
}

/** Test-only — reset between specs. */
export function resetHttpInflightMetricsForTests(): void {
  httpRequestsInFlight = 0;
}
