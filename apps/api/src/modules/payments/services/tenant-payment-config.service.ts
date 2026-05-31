import { Injectable } from "@nestjs/common";

import { LoggerService } from "../../../common/logger/logger.service";
import { ConfigService } from "../../../config/config.service";
import type {
  ResolvedPaymentGatewayCredentials,
  ResolvedStripeCredentials,
  ResolvedZibalCredentials,
} from "../gateway/payment-gateway-credentials.types";
import { TenantPaymentConfigRepository } from "../repositories/tenant-payment-config.repository";

type CachedCredentials = {
  expiresAt: number;
  value: ResolvedPaymentGatewayCredentials;
};

const CACHE_TTL_MS = 60_000;

export type TenantPaymentConfigCacheEvictionOrigin =
  | "subscriber:afterInsert"
  | "subscriber:afterUpdate"
  | "subscriber:afterRemove"
  | "subscriber:afterSoftRemove"
  | "subscriber:afterQuery"
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

  constructor(
    private readonly repository: TenantPaymentConfigRepository,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async resolveForProvider(
    tenantId: string,
    provider: string,
  ): Promise<ResolvedPaymentGatewayCredentials> {
    const normalizedProvider = provider.trim().toLowerCase();
    const cacheKey = `${tenantId.trim().toLowerCase()}:${normalizedProvider}`;
    const now = Date.now();
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return hit.value;
    }

    const value = await this.resolveUncached(tenantId, normalizedProvider);
    this.cache.set(cacheKey, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  }

  invalidateTenant(tenantId: string, trace?: TenantPaymentConfigCacheEvictionTrace): void {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      return;
    }
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
        keys_evicted: evictedKeys.length,
        evicted_cache_keys: evictedKeys,
        ...traceMeta,
      });
    }
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
    return { merchantId, callbackUrl };
  }
}
