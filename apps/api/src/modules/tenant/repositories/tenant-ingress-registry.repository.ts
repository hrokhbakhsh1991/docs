import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type Redis from "ioredis";
import { Repository } from "typeorm";

import { TenantEntity } from "../../identity/entities/tenant.entity";
import { TenantCustomDomainEntity } from "../entities/tenant-custom-domain.entity";
import type { TenantIngressRegistryPort } from "../domain/ports/tenant-ingress-registry.port";
import {
  TENANT_CORS_ORIGIN_CACHE_TTL_SECONDS,
  TENANT_CORS_ORIGIN_MEMORY_TTL_MS,
  TENANT_CUSTOM_DOMAIN_CACHE_TTL_SECONDS,
  TENANT_RESOLVER_REDIS,
} from "../tenant-resolver.constants";

type MemoryCacheEntry = {
  value: boolean;
  expiresAtMs: number;
};

const CUSTOM_DOMAIN_CACHE_PREFIX = "tenant_custom_domain:";
const CORS_ORIGIN_CACHE_PREFIX = "tenant_cors_origin:";

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function normalizeWebOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, "");
}

function hostnameFromWebOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Runtime registry for white-label FQDN host resolution and dynamic tenant CORS origins.
 * Redis backs cross-process memoization; an in-process TTL map avoids DB hits on hot preflights.
 */
@Injectable()
export class TenantIngressRegistryRepository implements TenantIngressRegistryPort {
  private readonly corsOriginMemoryCache = new Map<string, MemoryCacheEntry>();

  constructor(
    @InjectRepository(TenantCustomDomainEntity)
    private readonly customDomainRepository: Repository<TenantCustomDomainEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @Inject(TENANT_RESOLVER_REDIS) private readonly redis: Redis,
  ) {}

  private customDomainCacheKey(hostname: string): string {
    return `${CUSTOM_DOMAIN_CACHE_PREFIX}${normalizeHostname(hostname)}`;
  }

  private corsOriginCacheKey(origin: string): string {
    return `${CORS_ORIGIN_CACHE_PREFIX}${normalizeWebOrigin(origin)}`;
  }

  private readCorsOriginMemoryCache(origin: string): boolean | null {
    const key = normalizeWebOrigin(origin);
    const entry = this.corsOriginMemoryCache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAtMs <= Date.now()) {
      this.corsOriginMemoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private writeCorsOriginMemoryCache(origin: string, allowed: boolean): void {
    this.corsOriginMemoryCache.set(normalizeWebOrigin(origin), {
      value: allowed,
      expiresAtMs: Date.now() + TENANT_CORS_ORIGIN_MEMORY_TTL_MS,
    });
  }

  async invalidateCustomDomainCaches(input: {
    hostname?: string | null;
    webOrigin?: string | null;
  }): Promise<void> {
    const ops: Promise<unknown>[] = [];
    if (input.hostname?.trim()) {
      const host = normalizeHostname(input.hostname);
      ops.push(this.redis.del(this.customDomainCacheKey(host)).catch(() => undefined));
    }
    if (input.webOrigin?.trim()) {
      const origin = normalizeWebOrigin(input.webOrigin);
      this.corsOriginMemoryCache.delete(origin);
      ops.push(this.redis.del(this.corsOriginCacheKey(origin)).catch(() => undefined));
    }
    await Promise.all(ops);
  }

  async resolveTenantEntityByCustomHostname(hostname: string): Promise<TenantEntity | null> {
    const normalizedHost = normalizeHostname(hostname);
    if (!normalizedHost) {
      return null;
    }

    const cacheKey = this.customDomainCacheKey(normalizedHost);
    try {
      const cachedTenantId = await this.redis.get(cacheKey);
      if (cachedTenantId === "__none__") {
        return null;
      }
      if (cachedTenantId && cachedTenantId.trim() !== "") {
        // tenant-isolation:qb-exempt — trusted custom-domain cache entry → tenants root by id.
        return this.tenantRepository
          .createQueryBuilder("t")
          .where("t.id = :id", { id: cachedTenantId.trim() })
          .andWhere("t.deleted_at IS NULL")
          .getOne();
      }
    } catch {
      /* cache failures must not break ingress resolution */
    }

    const row = await this.customDomainRepository
      .createQueryBuilder("d")
      .innerJoinAndSelect("d.tenant", "t")
      .where("LOWER(d.hostname) = :host", { host: normalizedHost })
      .andWhere("d.is_active = true")
      .andWhere("t.deleted_at IS NULL")
      .getOne();

    const tenantId = row?.tenant?.id ?? null;
    try {
      await this.redis.set(
        cacheKey,
        tenantId ?? "__none__",
        "EX",
        TENANT_CUSTOM_DOMAIN_CACHE_TTL_SECONDS,
      );
    } catch {
      /* ignore cache set failures */
    }

    return row?.tenant ?? null;
  }

  /**
   * Returns whether `origin` is registered for an active workspace custom domain.
   * Uses memory → Redis → Postgres, memoizing denials as well as allows.
   */
  async isRegisteredWebOrigin(origin: string): Promise<boolean> {
    const normalizedOrigin = normalizeWebOrigin(origin);
    if (!normalizedOrigin) {
      return false;
    }

    const memory = this.readCorsOriginMemoryCache(normalizedOrigin);
    if (memory !== null) {
      return memory;
    }

    const cacheKey = this.corsOriginCacheKey(normalizedOrigin);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached === "1") {
        this.writeCorsOriginMemoryCache(normalizedOrigin, true);
        return true;
      }
      if (cached === "0") {
        this.writeCorsOriginMemoryCache(normalizedOrigin, false);
        return false;
      }
    } catch {
      /* continue to DB */
    }

    const originHostname = hostnameFromWebOrigin(normalizedOrigin);
    const qb = this.customDomainRepository
      .createQueryBuilder("d")
      .innerJoin("d.tenant", "t")
      .where("d.is_active = true")
      .andWhere("t.deleted_at IS NULL");

    if (originHostname) {
      qb.andWhere("(LOWER(d.web_origin) = :origin OR LOWER(d.hostname) = :host)", {
        origin: normalizedOrigin,
        host: originHostname,
      });
    } else {
      qb.andWhere("LOWER(d.web_origin) = :origin", { origin: normalizedOrigin });
    }

    const allowed = (await qb.getCount()) > 0;

    try {
      await this.redis.set(cacheKey, allowed ? "1" : "0", "EX", TENANT_CORS_ORIGIN_CACHE_TTL_SECONDS);
    } catch {
      /* ignore cache set failures */
    }
    this.writeCorsOriginMemoryCache(normalizedOrigin, allowed);
    return allowed;
  }
}
