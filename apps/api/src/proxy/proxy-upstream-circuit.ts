import { metricsRegistry } from "../observability/metrics";

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 30_000;

export class ProxyCircuitOpenError extends Error {
  readonly code = "PROXY_CIRCUIT_OPEN";

  constructor(readonly upstreamHost: string) {
    super(`PROXY_CIRCUIT_OPEN: ${upstreamHost}`);
    this.name = "ProxyCircuitOpenError";
  }
}

export function resolveProxyCircuitFailureThreshold(): number {
  const raw = process.env.PROXY_CIRCUIT_FAILURE_THRESHOLD?.trim();
  if (!raw) {
    return DEFAULT_FAILURE_THRESHOLD;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FAILURE_THRESHOLD;
}

export function resolveProxyCircuitOpenMs(): number {
  const raw = process.env.PROXY_CIRCUIT_OPEN_MS?.trim();
  if (!raw) {
    return DEFAULT_OPEN_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OPEN_MS;
}

/** Per-upstream-host circuit breaker (DEC-075 / PI-01). */
export class ProxyUpstreamCircuitBreaker {
  private consecutiveFailures = 0;
  private openedUntil = 0;

  constructor(
    private readonly upstreamHost: string,
    private readonly failureThreshold = resolveProxyCircuitFailureThreshold(),
    private readonly openMs = resolveProxyCircuitOpenMs()
  ) {}

  assertClosed(): void {
    if (Date.now() < this.openedUntil) {
      throw new ProxyCircuitOpenError(this.upstreamHost);
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedUntil = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openedUntil = Date.now() + this.openMs;
      this.consecutiveFailures = 0;
      metricsRegistry.increment("proxy_upstream_circuit_open_total", {
        upstream_host: this.upstreamHost,
      });
    }
  }
}
