import { HttpException, HttpStatus, Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type Redis from "ioredis";
import { ConfigService } from "../../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";
import {
  getTenantScopeKey,
  isTenantRuntimeApiPath,
  isTenantRuntimeLoginRoute,
  resolveTenantRuntimePath,
  shouldBypassTenantRuntimePath
} from "../tenant/tenant-runtime-policy";
import { resolveThrottleClientIp } from "../throttling/public-registration-throttle";
import { TENANT_ABUSE_REDIS } from "./tenant-abuse.constants";
import type { TenantRateLimitScope } from "./tenant-abuse.constants";
import { TenantAbuseMetricsService } from "./tenant-abuse-metrics.service";

/**
 * Atomic sliding-window counter using Redis sorted sets (scores = epoch ms).
 */
const SLIDING_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local n = redis.call('ZCARD', KEYS[1])
if tonumber(n) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

type InMemoryBucket = {
  tokens: number;
  lastRefillMs: number;
  lastSeenMs: number;
};

@Injectable()
export class TenantRateLimitService implements OnModuleDestroy {
  private readonly inMemoryBuckets = new Map<string, InMemoryBucket>();

  constructor(
    @Inject(TENANT_ABUSE_REDIS) private readonly redis: Redis,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(TenantAbuseMetricsService)
    private readonly abuseMetrics: TenantAbuseMetricsService
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async slidingAllow(
    key: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const member = `${now}:${randomUUID()}`;
    const ttlMs = windowMs + 5000;
    try {
      const result = (await this.redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        windowStart.toString(),
        now.toString(),
        limit.toString(),
        member,
        ttlMs.toString()
      )) as number;
      return result === 1;
    } catch (err: unknown) {
      this.abuseMetrics.recordRedisFailure();
      const mode = this.configService.getRateLimitFailMode();
      this.loggerService.warn("tenant_rate_limit_redis_error", {
        message: err instanceof Error ? err.message : String(err),
        redis_key: key,
        fail_mode: mode
      });
      if (mode === "fail_open") {
        return true;
      }
      if (mode === "fail_closed") {
        return false;
      }

      this.abuseMetrics.recordFallbackActivated();
      this.loggerService.warn("tenant_rate_limit_fallback_activated", {
        redis_key: key,
        strategy: "in_memory_token_bucket",
        fail_mode: mode
      });
      return this.allowWithInMemoryTokenBucket(key, windowMs, limit);
    }
  }

  private allowWithInMemoryTokenBucket(
    key: string,
    windowMs: number,
    limit: number
  ): boolean {
    const now = Date.now();
    this.compactInMemoryBuckets(now, windowMs);

    const refillPerMs = limit / windowMs;
    const bucket = this.inMemoryBuckets.get(key);
    if (!bucket) {
      // First hit gets one token consumed immediately.
      this.inMemoryBuckets.set(key, {
        tokens: Math.max(0, limit - 1),
        lastRefillMs: now,
        lastSeenMs: now
      });
      return true;
    }

    const elapsed = Math.max(0, now - bucket.lastRefillMs);
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillPerMs);
    bucket.lastRefillMs = now;
    bucket.lastSeenMs = now;

    if (bucket.tokens < 1) {
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }

  private compactInMemoryBuckets(now: number, windowMs: number): void {
    const staleAfterMs = Math.max(60_000, windowMs * 5);
    for (const [key, bucket] of this.inMemoryBuckets.entries()) {
      if (now - bucket.lastSeenMs > staleAfterMs) {
        this.inMemoryBuckets.delete(key);
      }
    }
  }

  private sanitizeIp(ip: string): string {
    return ip.replace(/:/g, "_").replace(/\s+/g, "");
  }

  private throwLimited(scope: TenantRateLimitScope, req: Request): never {
    const tenantId = getTenantScopeKey("tenant", req, {
      requestContextService: this.requestContextService,
      configService: this.configService
    });
    const userId = getTenantScopeKey("user", req, {
      requestContextService: this.requestContextService,
      configService: this.configService
    });
    const ip =
      getTenantScopeKey("ip", req, {
        requestContextService: this.requestContextService,
        configService: this.configService
      }) ?? "unknown";
    this.abuseMetrics.recordRateLimitExceeded(scope);

    let requestId = "";
    try {
      requestId = this.requestContextService.getRequestId();
    } catch {
      requestId = "";
    }

    this.loggerService.warn("tenant_rate_limit_exceeded", {
      tenant_id: tenantId ?? "",
      user_id: userId ?? "",
      endpoint: typeof req.path === "string" ? req.path : req.url,
      rate_limit: scope,
      client_ip: ip
    });

    throw new HttpException(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests for this limit scope",
          retryability: "RETRY_WITH_BACKOFF",
          details: { limit_scope: scope, request_id: requestId || undefined }
        }
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  async enforceHttpRateLimit(req: Request): Promise<void> {
    if (!this.configService.isTenantRateLimitEnabled()) {
      return;
    }

    const path = resolveTenantRuntimePath(req);
    if (shouldBypassTenantRuntimePath(path)) {
      return;
    }

    if (!isTenantRuntimeApiPath(path)) {
      return;
    }

    const ip = this.sanitizeIp(
      resolveThrottleClientIp(req as unknown as Record<string, unknown>, {
        trustedProxyCidrs: this.configService.getTrustedProxyCidrs()
      })
    );

    if (isTenantRuntimeLoginRoute(path, req.method)) {
      await this.enforceLogin(req, ip);
      return;
    }

    await this.enforceApi(req, ip);
  }

  async enforceHttp(req: Request): Promise<void> {
    await this.enforceHttpRateLimit(req);
  }

  private async enforceLogin(req: Request, ipSan: string): Promise<void> {
    const cfg = this.configService.getTenantRateLimitLoginConfig();
    const tenantId =
      getTenantScopeKey("tenant", req, {
        requestContextService: this.requestContextService,
        configService: this.configService
      }) ?? "_unknown";

    const tenantKey = `trl:v2:login:tenant:${tenantId}`;
    if (!(await this.slidingAllow(tenantKey, cfg.windowMs, cfg.perTenant))) {
      this.throwLimited("login_tenant", req);
    }

    const ipKey = `trl:v2:login:ip:${ipSan}`;
    if (!(await this.slidingAllow(ipKey, cfg.windowMs, cfg.perIp))) {
      this.throwLimited("login_ip", req);
    }
  }

  private async enforceApi(req: Request, ipSan: string): Promise<void> {
    const cfg = this.configService.getTenantRateLimitApiConfig();
    const tenantId =
      getTenantScopeKey("tenant", req, {
        requestContextService: this.requestContextService,
        configService: this.configService
      }) ?? "_public";
    const userId = getTenantScopeKey("user", req, {
      requestContextService: this.requestContextService,
      configService: this.configService
    });

    this.abuseMetrics.recordTenantRequestObserved(
      tenantId === "_public" ? undefined : tenantId
    );

    const tenantKey = `trl:v2:api:tenant:${tenantId}`;
    if (!(await this.slidingAllow(tenantKey, cfg.windowMs, cfg.perTenant))) {
      this.throwLimited("api_tenant", req);
    }

    if (userId && userId.trim() !== "") {
      const userKey = `trl:v2:api:user:${tenantId}:${userId.trim().toLowerCase()}`;
      if (!(await this.slidingAllow(userKey, cfg.windowMs, cfg.perUser))) {
        this.throwLimited("api_user", req);
      }
    }

    const ipKey = `trl:v2:api:ipt:${tenantId}:${ipSan}`;
    if (!(await this.slidingAllow(ipKey, cfg.windowMs, cfg.perIp))) {
      this.throwLimited("api_ip", req);
    }
  }

  /** Background reconciliation / tenant-scoped job budgets. Returns false when limit hit (caller should skip work). */
  async tryConsumeJobForTenant(tenantId: string): Promise<boolean> {
    if (!this.configService.isTenantRateLimitEnabled()) {
      return true;
    }
    const cfg = this.configService.getTenantRateLimitJobConfig();
    const tid = tenantId.trim().toLowerCase();
    const key = `trl:v2:job:tenant:${tid}`;
    const ok = await this.slidingAllow(key, cfg.windowMs, cfg.perTenant);
    if (!ok) {
      this.abuseMetrics.recordRateLimitExceeded("job_tenant");
      this.loggerService.warn("tenant_job_rate_limit_exceeded", {
        tenant_id: tid,
        user_id: "",
        endpoint: "reconciliation_cycle",
        rate_limit: "job_tenant",
        client_ip: ""
      });
    }
    return ok;
  }
}
