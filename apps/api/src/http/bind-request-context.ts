import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  consumeTenantRateLimit,
  type TenantRateLimitTier,
} from "../middleware/tenant-rate-limiter";
import { resolveTraceIdFromHeaders } from "../observability/resolve-trace-id";
import { runWithTraceContext } from "../observability/trace-request-context";
import { runWithTenantContext } from "../tenant/tenant-request-context";

export type HttpRequestContextOptions = {
  /** When true, enforce write-tier limit; `'read'` / `'write'` select independent buckets (DEC-015 / P0-8). */
  readonly rateLimit?: boolean | TenantRateLimitTier;
};

/**
 * Binds trace ALS (outer) and tenant ALS (inner) at the HTTP boundary.
 * Optional `rateLimit` runs {@link consumeTenantRateLimit} after auth + tenant ALS,
 * before route business logic — see docs/phase-5/appendices/rate-limiting.md.
 */
export async function runWithHttpRequestContext<T>(
  req: IncomingMessage,
  auth: TenantAuthContext,
  run: () => Promise<T>,
  options?: HttpRequestContextOptions
): Promise<T> {
  const traceId = resolveTraceIdFromHeaders(req.headers);
  return runWithTraceContext(traceId, () =>
    runWithTenantContext(
      auth.tenantId,
      async () => {
        if (options?.rateLimit) {
          const tier: TenantRateLimitTier =
            options.rateLimit === true ? "write" : options.rateLimit;
          await consumeTenantRateLimit(tier);
        }
        return run();
      },
      {
        actorId: auth.userId,
      }
    )
  );
}
