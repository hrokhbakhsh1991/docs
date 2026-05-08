import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { BlockList, isIP } from "node:net";
import { Repository } from "typeorm";
import type Redis from "ioredis";
import { ObservabilityMetricsService } from "../../common/observability/observability-metrics.service";
import { ConfigService } from "../../config/config.service";
import { TENANT_SUBDOMAIN_REGEX, TenantEntity } from "../identity/entities/tenant.entity";
import {
  TENANT_HOST_CACHE_TTL_SECONDS,
  TENANT_RESOLVER_REDIS
} from "./tenant-resolver.constants";

/** RFC 1035-ish hostname length bound for DNS over HTTP Host. */
export const TENANT_MAX_HOST_LENGTH = 255;

export type WorkspaceTenantLabelOutcome =
  | { kind: "no_root_config" }
  | { kind: "apex" }
  | { kind: "outside_workspace" }
  | { kind: "reserved"; label: string }
  | { kind: "invalid_label"; label: string }
  | { kind: "label"; label: string };

export type TenantHostTrustModel = {
  trustProxy: boolean;
  trustedProxyCidrs: string[];
  baseDomain: string;
};

/**
 * Validates and normalizes an inbound Host / forwarded-host value:
 * lowercase, port stripped, length ≤255, rejects "..", rejects invalid DNS hostname structure.
 */
export function normalizeInboundHostname(raw: string): { ok: true; host: string } | { ok: false } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false };
  }

  const withoutPort = TenantHostResolverService.stripHostPort(trimmed);
  if (!withoutPort) {
    return { ok: false };
  }

  if (withoutPort.length > TENANT_MAX_HOST_LENGTH) {
    return { ok: false };
  }

  if (withoutPort.includes("..")) {
    return { ok: false };
  }

  if (!isValidHostnameStructure(withoutPort)) {
    return { ok: false };
  }

  return { ok: true, host: withoutPort };
}

function isValidHostnameStructure(host: string): boolean {
  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1);
    return inner.length >= 1 && /^[0-9a-f:]+$/i.test(inner);
  }

  const labels = host.split(".");
  if (labels.length < 1 || labels.length > 127) {
    return false;
  }

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return false;
    }
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
      return false;
    }
  }

  return true;
}

/**
 * Pure parsing: maps `{label}.{root}` → workspace label when label matches {@link TENANT_SUBDOMAIN_REGEX}
 * and is not reserved.
 */
export function parseWorkspaceTenantLabelFromHost(
  normalizedHost: string,
  rootDomain: string,
  reservedLabels: Set<string>
): WorkspaceTenantLabelOutcome {
  const root = rootDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!root) {
    return { kind: "no_root_config" };
  }

  const h = normalizedHost.trim().toLowerCase();
  if (h === root) {
    return { kind: "apex" };
  }

  const suffix = `.${root}`;
  if (!h.endsWith(suffix)) {
    return { kind: "outside_workspace" };
  }

  const label = h.slice(0, -suffix.length);
  if (!label || label.includes(".")) {
    return { kind: "outside_workspace" };
  }

  if (reservedLabels.has(label)) {
    return { kind: "reserved", label };
  }

  if (!TENANT_SUBDOMAIN_REGEX.test(label)) {
    return { kind: "invalid_label", label };
  }

  return { kind: "label", label };
}

export function resolveTenantFromHost(host: string, baseDomain: string): string | null {
  const normalizedHost = normalizeInboundHostname(host);
  if (!normalizedHost.ok) {
    return null;
  }
  const root = baseDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!root) {
    return null;
  }
  const h = normalizedHost.host;
  if (h === root) {
    return null;
  }
  const suffix = `.${root}`;
  if (!h.endsWith(suffix)) {
    return null;
  }
  const label = h.slice(0, -suffix.length);
  if (!label || label.includes(".")) {
    return null;
  }
  return label;
}

/**
 * Maps inbound HTTP host → tenant UUID via `tenants.subdomain` (canonical id remains `tenants.id`).
 * Disabled when `TENANT_ROOT_DOMAIN` is empty.
 */
@Injectable()
export class TenantHostResolverService implements OnModuleDestroy {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(ObservabilityMetricsService)
    private readonly observabilityMetrics: ObservabilityMetricsService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @Inject(TENANT_RESOLVER_REDIS) private readonly redis: Redis
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private tenantHostCacheKey(normalizedHost: string): string {
    return `tenant_host:${normalizedHost}`;
  }

  private buildWorkspaceHostFromLabel(label: string): string | null {
    const root = this.configService.getTenantRootDomain();
    const l = label.trim().toLowerCase();
    if (!root || !l) {
      return null;
    }
    if (!TENANT_SUBDOMAIN_REGEX.test(l)) {
      return null;
    }
    return `${l}.${root}`;
  }

  async invalidateTenantHostCacheByHostname(hostname: string): Promise<void> {
    const norm = normalizeInboundHostname(hostname);
    if (!norm.ok) {
      return;
    }
    try {
      await this.redis.del(this.tenantHostCacheKey(norm.host));
    } catch {
      /* ignore cache invalidation failures */
    }
  }

  async invalidateTenantHostCacheByLabel(label: string): Promise<void> {
    const host = this.buildWorkspaceHostFromLabel(label);
    if (!host) {
      return;
    }
    await this.invalidateTenantHostCacheByHostname(host);
  }

  private static normalizeIp(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const deMapped = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
    return isIP(deMapped) === 0 ? undefined : deMapped;
  }

  private static buildTrustedProxyBlockList(trustedProxyCidrs: string[]): BlockList {
    const blockList = new BlockList();
    for (const rawEntry of trustedProxyCidrs) {
      const entry = rawEntry.trim();
      if (!entry) {
        continue;
      }
      const slash = entry.indexOf("/");
      if (slash < 0) {
        const ip = TenantHostResolverService.normalizeIp(entry);
        if (!ip) {
          continue;
        }
        blockList.addAddress(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
        continue;
      }
      const network = TenantHostResolverService.normalizeIp(entry.slice(0, slash));
      const prefix = Number(entry.slice(slash + 1));
      if (!network || !Number.isInteger(prefix)) {
        continue;
      }
      const family = isIP(network) === 6 ? "ipv6" : "ipv4";
      const maxBits = family === "ipv6" ? 128 : 32;
      if (prefix < 0 || prefix > maxBits) {
        continue;
      }
      blockList.addSubnet(network, prefix, family);
    }
    return blockList;
  }

  private static isTrustedProxyIp(ip: string, trustedProxyCidrs: string[]): boolean {
    const blockList = TenantHostResolverService.buildTrustedProxyBlockList(trustedProxyCidrs);
    return blockList.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
  }

  private static shouldTrustForwardedHost(
    req: Request,
    trustModel: TenantHostTrustModel
  ): boolean {
    if (!trustModel.trustProxy) {
      return false;
    }
    // Fail closed: forwarded host is ignored unless trusted proxy CIDRs are explicitly configured.
    if (trustModel.trustedProxyCidrs.length === 0) {
      return false;
    }
    const remoteIp = TenantHostResolverService.normalizeIp(
      req.socket?.remoteAddress ?? req.connection?.remoteAddress
    );
    if (!remoteIp) {
      return false;
    }
    return TenantHostResolverService.isTrustedProxyIp(
      remoteIp,
      trustModel.trustedProxyCidrs
    );
  }

  static extractInboundHost(req: Request, trustModel: TenantHostTrustModel): string | undefined {
    let candidate: string | undefined;
    if (TenantHostResolverService.shouldTrustForwardedHost(req, trustModel)) {
      const forwarded = req.headers["x-forwarded-host"];
      if (forwarded) {
        const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        const first = raw.split(",")[0]?.trim() ?? "";
        const norm = normalizeInboundHostname(first);
        if (norm.ok) {
          candidate = norm.host;
        }
      }
    }

    if (!candidate) {
      const hn = typeof req.hostname === "string" ? req.hostname : "";
      const norm = normalizeInboundHostname(hn);
      if (norm.ok) {
        candidate = norm.host;
      }
    }

    return candidate;
  }

  /** Strip `:port` from host[:port]; supports bracketed IPv6. */
  static stripHostPort(hostWithOptionalPort: string): string {
    const trimmed = hostWithOptionalPort.trim();
    if (trimmed.startsWith("[") && trimmed.includes("]")) {
      const end = trimmed.indexOf("]");
      return trimmed.slice(0, end + 1);
    }
    const colonIndex = trimmed.lastIndexOf(":");
    if (colonIndex > 0 && trimmed.slice(colonIndex + 1).match(/^\d+$/)) {
      return trimmed.slice(0, colonIndex);
    }
    return trimmed;
  }

  parseWorkspaceTenantLabel(normalizedHost: string): WorkspaceTenantLabelOutcome {
    const resolved = resolveTenantFromHost(
      normalizedHost,
      this.configService.getTenantRootDomain()
    );
    if (resolved === null) {
      const root = this.configService.getTenantRootDomain();
      if (!root) return { kind: "no_root_config" };
      if (normalizedHost.trim().toLowerCase() === root) return { kind: "apex" };
      return { kind: "outside_workspace" };
    }
    if (this.configService.getTenantHostReservedSubdomains().has(resolved)) {
      return { kind: "reserved", label: resolved };
    }
    if (!TENANT_SUBDOMAIN_REGEX.test(resolved)) {
      return { kind: "invalid_label", label: resolved };
    }
    return { kind: "label", label: resolved };
  }

  /**
   * Parse `{tenantLabel}.{TENANT_ROOT_DOMAIN}` → tenant label, or `null` if not applicable.
   */
  extractTenantLabelFromHost(host: string): string | null {
    const norm = normalizeInboundHostname(host);
    if (!norm.ok) {
      return null;
    }
    const outcome = this.parseWorkspaceTenantLabel(norm.host);
    return outcome.kind === "label" ? outcome.label : null;
  }

  extractTenantLabelFromInboundRequest(req: Request): string | null {
    const inbound = TenantHostResolverService.extractInboundHost(
      req,
      this.configService.getTenantHostTrustModel()
    );
    if (!inbound) {
      return null;
    }
    const outcome = this.parseWorkspaceTenantLabel(inbound);
    return outcome.kind === "label" ? outcome.label : null;
  }

  async resolveTenantEntityByLabel(label: string): Promise<TenantEntity | null> {
    const lowered = label.trim().toLowerCase();
    return this.tenantRepository
      .createQueryBuilder("t")
      .where("LOWER(t.subdomain) = :sub", { sub: lowered })
      .andWhere("t.deleted_at IS NULL")
      .getOne();
  }

  async resolveTenantEntityFromHost(host: string): Promise<TenantEntity | null> {
    const norm = normalizeInboundHostname(host);
    if (!norm.ok) {
      return null;
    }
    const outcome = this.parseWorkspaceTenantLabel(norm.host);
    if (outcome.kind !== "label") {
      return null;
    }
    const cacheKey = this.tenantHostCacheKey(norm.host);
    try {
      const cachedTenantId = await this.redis.get(cacheKey);
      if (cachedTenantId && cachedTenantId.trim() !== "") {
        this.observabilityMetrics.recordTenantResolverCacheHit();
        return this.tenantRepository
          .createQueryBuilder("t")
          .where("t.id = :id", { id: cachedTenantId.trim() })
          .andWhere("t.deleted_at IS NULL")
          .getOne();
      }
    } catch {
      /* resolver cache failure must not break tenant resolution */
    }

    this.observabilityMetrics.recordTenantResolverCacheMiss();
    const tenant = await this.resolveTenantEntityByLabel(outcome.label);
    if (!tenant) {
      return null;
    }
    try {
      await this.redis.set(
        cacheKey,
        tenant.id,
        "EX",
        TENANT_HOST_CACHE_TTL_SECONDS
      );
    } catch {
      /* ignore cache set failures */
    }
    return tenant;
  }

  async resolveTenantEntityFromRequest(req: Request): Promise<TenantEntity | null> {
    const inbound = TenantHostResolverService.extractInboundHost(
      req,
      this.configService.getTenantHostTrustModel()
    );
    if (!inbound) {
      return null;
    }
    const outcome = this.parseWorkspaceTenantLabel(inbound);
    if (outcome.kind !== "label") {
      return null;
    }
    return this.resolveTenantEntityByLabel(outcome.label);
  }

  async resolveTenantIdFromHost(host: string): Promise<string | null> {
    const row = await this.resolveTenantEntityFromHost(host);
    return row?.id ?? null;
  }

  async resolveTenantIdFromRequest(req: Request): Promise<string | null> {
    const row = await this.resolveTenantEntityFromRequest(req);
    return row?.id ?? null;
  }
}
