import { requireActiveTenantId } from "../tenant/tenant-request-context";
import { ProxyUpstreamCircuitBreaker } from "./proxy-upstream-circuit";
import {
  isProxyUpstreamTimeoutError,
  ProxyUpstreamTimeoutError,
  recordProxyUpstreamTimeout,
  resolveProxyUpstreamTimeoutMs,
} from "./proxy-upstream-timeout";

/** Outbound header injected from ALS — matches ingress `x-tenant-id` convention. */
export const TENANT_PROXY_OUTBOUND_HEADER = "x-tenant-id";

export type TenantHttpProxyConfig = {
  /** Upstream base URL (mock map service in tests). */
  readonly upstreamBaseUrl: string;
  /** When true, cache successful GET bodies per tenant + URL. */
  readonly cacheResponses?: boolean;
};

type CacheEntry = {
  readonly body: string;
  readonly contentType: string | null;
  readonly status: number;
};

function buildCacheKey(tenantId: string, method: string, url: string): string {
  return `${tenantId}\u0000${method}\u0000${url}`;
}

function resolveUpstreamSignal(init: RequestInit, timeoutMs: number): AbortSignal {
  if (init.signal !== undefined && init.signal !== null) {
    return init.signal;
  }
  return AbortSignal.timeout(timeoutMs);
}

function isUpstreamServerError(status: number): boolean {
  return status >= 500;
}

/**
 * Outbound HTTP proxy for external APIs (map / enrichment).
 * Requires {@link runWithTenantContext} at the call site.
 */
export class TenantHttpProxy {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly circuit: ProxyUpstreamCircuitBreaker;

  constructor(private readonly config: TenantHttpProxyConfig) {
    const host = new URL(config.upstreamBaseUrl).host;
    this.circuit = new ProxyUpstreamCircuitBreaker(host);
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const tenantId = requireActiveTenantId();
    const method = (init.method ?? "GET").toUpperCase();
    const url = new URL(path, this.config.upstreamBaseUrl).href;
    const timeoutMs = resolveProxyUpstreamTimeoutMs();

    if (this.config.cacheResponses === true && method === "GET") {
      const cached = this.cache.get(buildCacheKey(tenantId, method, url));
      if (cached !== undefined) {
        const headers = new Headers();
        if (cached.contentType !== null) {
          headers.set("content-type", cached.contentType);
        }
        headers.set("x-proxy-cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers });
      }
    }

    this.circuit.assertClosed();

    const headers = new Headers(init.headers);
    headers.set(TENANT_PROXY_OUTBOUND_HEADER, tenantId);

    try {
      const upstream = await fetch(url, {
        ...init,
        method,
        headers,
        signal: resolveUpstreamSignal(init, timeoutMs),
      });

      if (isUpstreamServerError(upstream.status)) {
        this.circuit.recordFailure();
      } else {
        this.circuit.recordSuccess();
      }

      if (this.config.cacheResponses === true && method === "GET" && upstream.ok) {
        const body = await upstream.text();
        this.cache.set(buildCacheKey(tenantId, method, url), {
          body,
          contentType: upstream.headers.get("content-type"),
          status: upstream.status,
        });
        const outHeaders = new Headers(upstream.headers);
        outHeaders.set("x-proxy-cache", "MISS");
        return new Response(body, { status: upstream.status, headers: outHeaders });
      }

      return upstream;
    } catch (error: unknown) {
      if (isProxyUpstreamTimeoutError(error)) {
        recordProxyUpstreamTimeout(url);
        this.circuit.recordFailure();
        throw new ProxyUpstreamTimeoutError(url, timeoutMs);
      }
      this.circuit.recordFailure();
      throw error;
    }
  }

  /** Test seam — reset in-memory cache between scenarios. */
  clearCache(): void {
    this.cache.clear();
  }
}
