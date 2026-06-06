import { metricsRegistry } from "../observability/metrics";

const DEFAULT_TIMEOUT_MS = 5_000;

export class ProxyUpstreamTimeoutError extends Error {
  readonly code = "PROXY_UPSTREAM_TIMEOUT";

  constructor(
    readonly upstreamUrl: string,
    readonly timeoutMs: number
  ) {
    super(`PROXY_UPSTREAM_TIMEOUT: ${upstreamUrl} (${timeoutMs}ms)`);
    this.name = "ProxyUpstreamTimeoutError";
  }
}

export function resolveProxyUpstreamTimeoutMs(): number {
  const raw = process.env.PROXY_UPSTREAM_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function isProxyUpstreamTimeoutError(error: unknown): boolean {
  if (error instanceof ProxyUpstreamTimeoutError) {
    return true;
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return error.message.includes("timeout") || error.message.includes("aborted");
  }
  return false;
}

export function recordProxyUpstreamTimeout(upstreamUrl: string): void {
  metricsRegistry.increment("proxy_upstream_timeout_total", { upstream_url: upstreamUrl });
}
