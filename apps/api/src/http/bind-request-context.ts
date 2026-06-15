import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  consumeTenantRateLimit,
  type TenantRateLimitTier,
} from "../middleware/tenant-rate-limiter";
import {
  acquireWeightedFairAdmission,
  releaseWeightedFairAdmission,
} from "./weighted-fair-admission";
import { withTourWriteConcurrencyBudget } from "./tour-write-concurrency-budget";
import { normalizeHttpLogPath } from "../observability/log-safety";
import { resolveTraceIdFromHeaders } from "../observability/resolve-trace-id";
import { getActiveTraceId, runWithTraceContext } from "../observability/trace-request-context";
import { getTenantConnectionRouter } from "../tenant/tenant-connection-router";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { runWithTenantContext } from "../tenant/tenant-request-context";

export type HttpRequestContextOptions = {
  /** When true, enforce write-tier limit; `'read'` / `'write'` select independent buckets (DEC-015 / P0-8). */
  readonly rateLimit?: boolean | TenantRateLimitTier;
  /** Cap concurrent in-flight POST /tours per tenant (DEC-064 / SCAL-DEBT-09). */
  readonly tourWriteConcurrency?: boolean;
};

/**
 * Binds tenant ALS at the HTTP boundary; reuses outer trace ALS from `app.ts` when
 * already bound (DEC-044 / TRACE-REGEN-01 — no second `resolveTraceIdFromHeaders`).
 * Optional `rateLimit` runs {@link consumeTenantRateLimit} after auth + tenant ALS,
 * before route business logic — see docs/phase-5/appendices/rate-limiting.md.
 *
 * Tenant ALS is entered synchronously before any async resolve so {@link withTenantRls}
 * checks cannot race under concurrent HTTP load (TK-LOAD-RLS / DEC-028).
 */
export async function runWithHttpRequestContext<T>(
  req: IncomingMessage,
  auth: TenantAuthContext,
  run: () => Promise<T>,
  options?: HttpRequestContextOptions
): Promise<T> {
  const rateLimitRoute =
    options?.rateLimit !== undefined
      ? {
          method: (req.method ?? "GET").toUpperCase(),
          path: normalizeHttpLogPath(req.url ?? "/"),
        }
      : undefined;

  const executeWithinTenantContext = async (): Promise<T> => {
    const [workspaceType, tenantRoute] = await Promise.all([
      resolveWorkspaceTypeForTenant(auth.tenantId),
      getTenantConnectionRouter().resolveRoute(auth.tenantId),
    ]);

    return runWithTenantContext(
      auth.tenantId,
      async () => {
        await acquireWeightedFairAdmission(auth.tenantId);
        try {
          const execute = async () => {
            if (options?.rateLimit) {
              const tier: TenantRateLimitTier =
                options.rateLimit === true ? "write" : options.rateLimit;
              await consumeTenantRateLimit(tier, rateLimitRoute);
            }
            return run();
          };

          if (options?.tourWriteConcurrency) {
            return await withTourWriteConcurrencyBudget(auth.tenantId, execute);
          }
          return await execute();
        } finally {
          releaseWeightedFairAdmission();
        }
      },
      {
        actorId: auth.userId,
        workspaceType,
        tenantTier: tenantRoute.tier,
      }
    );
  };

  const runWithTenant = () =>
    runWithTenantContext(auth.tenantId, executeWithinTenantContext, {
      actorId: auth.userId,
    });

  const existingTrace = getActiveTraceId();
  if (existingTrace !== undefined) {
    return runWithTenant();
  }

  const traceId = resolveTraceIdFromHeaders(req.headers);
  return runWithTraceContext(traceId, runWithTenant);
}
