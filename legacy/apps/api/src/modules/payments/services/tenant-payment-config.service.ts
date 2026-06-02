import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import type Redis from "ioredis";
import {
  EgressUrlForbiddenError,
  fetchWithPinnedEgress,
  ForbiddenException,
} from "@repo/security/egress-url";

import { LoggerService } from "../../../common/logger/logger.service";
import { ConfigService } from "../../../config/config.service";
import { REDIS_CLIENT } from "../../../infra/redis/redis.constants";
import type {
  ResolvedPaymentGatewayCredentials,
  ResolvedStripeCredentials,
  ResolvedZibalCredentials,
} from "../gateway/payment-gateway-credentials.types";
import { TenantPaymentConfigRepository } from "../repositories/tenant-payment-config.repository";
import { tenantPaymentConfigInvalidateChannel } from "../tenant-payment-config-cache.constants";

type CachedCredentials = {
  expiresAt: number;
  generation: number;
  value: ResolvedPaymentGatewayCredentials;
};

const CACHE_TTL_MS = 60_000;
const MAX_REPOPULATE_RETRIES = 3;

export type TenantPaymentConfigCacheEvictionOrigin =
  | "subscriber:afterInsert"
  | "subscriber:afterUpdate"
  | "subscriber:afterRemove"
  | "subscriber:afterSoftRemove"
  | "subscriber:afterQuery"
  | "pubsub:remote"
  | "manual";

export type TenantPaymentConfigCacheEvictionTrace = {
  origin: TenantPaymentConfigCacheEvictionOrigin;
  [key: string]: unknown;
};

/**
 * Loads per-tenant PSP credentials from `tenant_payment_configs`, falling back to
 * platform env vars when no active row exists (pilot / integration tests).
 */
@Injectable()
export class TenantPaymentConfigService {
  private readonly cache = new Map<string, CachedCredentials>();
  private readonly tenantCacheGenerations = new Map<string, number>();

  constructor(
    private readonly repository: TenantPaymentConfigRepository,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async resolveForProvider(
    tenantId: string,
    provider: string,
    repopulateAttempt = 0,
  ): Promise<ResolvedPaymentGatewayCredentials> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    const normalizedProvider = provider.trim().toLowerCase();
    const cacheKey = `${normalizedTenantId}:${normalizedProvider}`;
    const now = Date.now();
    const workspaceGeneration = this.getTenantGeneration(normalizedTenantId);
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > now && hit.generation === workspaceGeneration) {
      return hit.value;
    }

    const generationAtFetchStart = workspaceGeneration;
    const value = await this.resolveUncached(tenantId, normalizedProvider);
    const generationAfterFetch = this.getTenantGeneration(normalizedTenantId);

    if (generationAfterFetch !== generationAtFetchStart) {
      this.logger.info("tenant_payment_config_cache_repopulation_dropped", {
        tenant_id: normalizedTenantId,
        provider: normalizedProvider,
        generation_at_fetch_start: generationAtFetchStart,
        generation_after_fetch: generationAfterFetch,
        repopulate_attempt: repopulateAttempt,
      });
      if (repopulateAttempt >= MAX_REPOPULATE_RETRIES) {
        return value;
      }
      return this.resolveForProvider(tenantId, provider, repopulateAttempt + 1);
    }

    this.cache.set(cacheKey, {
      value,
      expiresAt: now + CACHE_TTL_MS,
      generation: generationAfterFetch,
    });
    return value;
  }

  async publishDistributedInvalidation(tenantId: string): Promise<void> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      return;
    }
    try {
      await this.redis.publish(
        tenantPaymentConfigInvalidateChannel(normalizedTenantId),
        normalizedTenantId,
      );
    } catch (error: unknown) {
      this.logger.warn("tenant_payment_config_pubsub_publish_failed", {
        tenant_id: normalizedTenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  invalidateTenant(tenantId: string, trace?: TenantPaymentConfigCacheEvictionTrace): void {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      return;
    }
    const nextGeneration = this.bumpTenantGeneration(normalizedTenantId);
    const prefix = `${normalizedTenantId}:`;
    const evictedKeys: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        evictedKeys.push(key);
      }
    }
    if (trace) {
      const { origin, ...traceMeta } = trace;
      this.logger.info("tenant_payment_config_cache_eviction", {
        tenant_id: normalizedTenantId,
        eviction_origin: origin,
        cache_generation: nextGeneration,
        keys_evicted: evictedKeys.length,
        evicted_cache_keys: evictedKeys,
        ...traceMeta,
      });
    }
  }

  private getTenantGeneration(tenantId: string): number {
    return this.tenantCacheGenerations.get(tenantId.trim().toLowerCase()) ?? 0;
  }

  private bumpTenantGeneration(tenantId: string): number {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    const next = this.getTenantGeneration(normalizedTenantId) + 1;
    this.tenantCacheGenerations.set(normalizedTenantId, next);
    return next;
  }

  private async resolveUncached(
    tenantId: string,
    provider: string,
  ): Promise<ResolvedPaymentGatewayCredentials> {
    if (provider === "stripe") {
      return { provider: "stripe", stripe: await this.resolveStripe(tenantId) };
    }
    if (provider === "zibal") {
      return { provider: "zibal", zibal: await this.resolveZibal(tenantId) };
    }
    return { provider: "mock" };
  }

  private async resolveStripe(tenantId: string): Promise<ResolvedStripeCredentials> {
    const row = await this.repository.findActiveByTenantAndProvider(tenantId, "stripe");
    const secretKey = (row?.apiKey ?? "").trim() || this.config.getStripeSecretKey();
    return { secretKey };
  }

  private async resolveZibal(tenantId: string): Promise<ResolvedZibalCredentials> {
    const row = await this.repository.findActiveByTenantAndProvider(tenantId, "zibal");
    const merchantId = (row?.merchantId ?? "").trim() || this.config.getZibalMerchant();
    const callbackUrl = (row?.callbackUrl ?? "").trim() || this.config.getZibalCallbackUrl();
    if (callbackUrl) {
      try {
        await fetchWithPinnedEgress(callbackUrl, { egressCoupledValidateOnly: true });
      } catch (error) {
        if (error instanceof EgressUrlForbiddenError || error instanceof ForbiddenException) {
          throw new InternalServerErrorException({
            error: {
              code: "TENANT_CALLBACK_URL_FORBIDDEN",
              message: "Configured Zibal callback URL targets a blocked or private network destination",
            },
          });
        }
        throw error;
      }
    }
    return { merchantId, callbackUrl };
  }
}
