/**
 * Shared rate-limiter contracts — leaf module to avoid store ↔ middleware cycles.
 */
export interface RateLimiterStore {
  consume(
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void>;
}

export type TenantRateLimitConfig = {
  readonly enabled: boolean;
  readonly points: number;
  readonly durationSec: number;
};

export type TenantRateLimitTier = "read" | "write";
