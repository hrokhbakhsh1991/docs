import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

import {
  assertCacheInvalidateServiceJwt,
  readAuthorizationHeader,
} from "../../internal/verify-cache-invalidate-service-jwt";
import { assertProvisioningDevelopmentOnly } from "../../internal/provisioning-guard";
import { isProductionAuthMode } from "../../tenant-kernel/auth-env";
import { handleHttpError } from "../../middleware/error-interceptor";
import { flushRedisRateLimitKeys } from "../../middleware/flush-redis-rate-limit-keys";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../../http/json";
import { activateFeatureFlagFreeze } from "../../tenant/feature-flag-freeze";
import { invalidateTenantRegistryCache } from "../../tenant/tenant-registry-cache";

const bodySchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    subdomain: z.string().min(1).optional(),
    flushRateLimit: z.boolean().optional(),
    freezeFeatureFlags: z.boolean().optional(),
    featureFlagFreezeSeconds: z.number().int().min(1).max(3600).optional(),
  })
  .strict();

async function assertCacheInvalidateAllowed(req: IncomingMessage): Promise<void> {
  if (isProductionAuthMode()) {
    await assertCacheInvalidateServiceJwt(readAuthorizationHeader(req));
    return;
  }
  assertProvisioningDevelopmentOnly();
}

export async function handleCacheInvalidate(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertCacheInvalidateAllowed(req);
    const rawBody = await readRequestBodyRaw(req);
    const body = bodySchema.parse(parseJsonBody(rawBody));

    let registryInvalidated = false;
    if (body.tenantId !== undefined) {
      invalidateTenantRegistryCache(body.tenantId, body.subdomain);
      registryInvalidated = true;
    }

    let rateLimitKeysDeleted = 0;
    if (body.flushRateLimit === true) {
      const redisUrl = process.env.REDIS_URL?.trim();
      if (redisUrl !== undefined && redisUrl.length > 0) {
        rateLimitKeysDeleted = await flushRedisRateLimitKeys(redisUrl);
      }
    }

    let featureFlagFreezeUntil: string | null = null;
    if (body.freezeFeatureFlags === true) {
      featureFlagFreezeUntil = activateFeatureFlagFreeze(
        body.featureFlagFreezeSeconds
      ).toISOString();
    }

    sendJson(res, 200, {
      ok: true,
      registryInvalidated,
      rateLimitKeysDeleted,
      featureFlagFreezeUntil,
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}
