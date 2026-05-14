import { Injectable } from "@nestjs/common";
import type {
  DatabaseConfig,
  EnvVariables,
  LogLevel,
  RedisConfig
} from "./env.types";
import { validateEnvironmentOrThrow } from "./config.validation";

@Injectable()
export class ConfigService {
  private readonly env: EnvVariables;

  constructor() {
    this.env = validateEnvironmentOrThrow(process.env);
  }

  getNodeEnv() {
    return this.env.NODE_ENV;
  }

  getPort() {
    return this.env.PORT;
  }

  getDatabaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  getLogLevel(): LogLevel {
    return this.env.LOG_LEVEL;
  }

  getDatabaseConfig(): DatabaseConfig {
    return {
      host: this.env.DATABASE_HOST,
      port: this.env.DATABASE_PORT,
      user: this.env.DATABASE_USER,
      password: this.env.DATABASE_PASSWORD,
      name: this.env.DATABASE_NAME
    };
  }

  getJwtPublicKey(): string {
    return this.env.JWT_PUBLIC_KEY;
  }

  getJwtPrivateKey(): string {
    return this.env.JWT_PRIVATE_KEY;
  }

  getJwtIssuer(): string {
    return this.env.JWT_ISSUER;
  }

  getJwtAudience(): string {
    return this.env.JWT_AUDIENCE;
  }

  getTelegramBotToken(): string {
    return this.env.TELEGRAM_BOT_TOKEN;
  }

  /**
   * UNSAFE local helper for OTP debugging. Always keep disabled outside local development.
   */
  getAuthAllowDevStaticOtp(): boolean {
    const explicit = process.env.AUTH_ALLOW_DEV_STATIC_OTP;
    if (explicit === "true") {
      return true;
    }
    if (explicit === "false") {
      return false;
    }
    return this.env.NODE_ENV === "development" || this.env.NODE_ENV === "test";
  }

  getRedisConfig(): RedisConfig {
    return {
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT
    };
  }

  getEnableSchedulers(): boolean {
    if (this.env.NODE_ENV === "test") {
      return false;
    }
    return this.env.ENABLE_SCHEDULERS === "true";
  }

  getRuntimeRole(): "api" | "worker" | "all" {
    return this.env.APP_RUNTIME_ROLE;
  }

  getSchedulerJitterMs(): number {
    return this.env.JOB_SCHEDULER_JITTER_MS;
  }

  shouldRunSchedulers(): boolean {
    if (!this.getEnableSchedulers()) {
      return false;
    }
    const role = this.getRuntimeRole();
    return role === "worker" || role === "all";
  }

  getOutboxPollIntervalMs(): number {
    return this.env.OUTBOX_POLL_INTERVAL_MS;
  }

  getOutboxMaxRetry(): number {
    return this.env.OUTBOX_MAX_RETRY;
  }

  getOutboxBatchSize(): number {
    return this.env.OUTBOX_BATCH_SIZE;
  }

  /** Disabled automatically in test; override with OUTBOX_PROCESSOR_ENABLED=false. */
  getOutboxProcessorEnabled(): boolean {
    if (this.env.NODE_ENV === "test") {
      return false;
    }
    return this.env.OUTBOX_PROCESSOR_ENABLED === "true";
  }

  /** Unsafe outside dev/tests: in-process domain event bus instead of outbox-only emission. */
  getEnableInMemoryDomainEvents(): boolean {
    return this.env.ENABLE_IN_MEMORY_DOMAIN_EVENTS === "true";
  }

  getInternalApiKey(): string {
    return this.env.INTERNAL_API_KEY;
  }

  getPaymentsWebhookSigningSecret(): string {
    return this.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  }

  /** Secondary secret for rotation; empty disables dual-verify. */
  getPaymentsWebhookSigningSecretPrevious(): string {
    return this.env.PAYMENTS_WEBHOOK_SIGNING_SECRET_PREVIOUS?.trim() ?? "";
  }

  /** Parsed allowlist; empty means any IP (configure in production). */
  getPaymentsWebhookAllowedIps(): string[] {
    return this.env.PAYMENTS_WEBHOOK_ALLOWED_IPS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Disabled automatically in test regardless of RECONCILIATION_ENABLED. */
  getReconciliationEnabled(): boolean {
    if (this.env.NODE_ENV === "test") {
      return false;
    }
    return this.env.RECONCILIATION_ENABLED === "true";
  }

  getReconciliationIntervalMs(): number {
    return this.env.RECONCILIATION_INTERVAL_MS;
  }

  /** Disabled automatically in test regardless of PAYMENTS_TIMEOUT_ENABLED. */
  getPaymentsTimeoutEnabled(): boolean {
    if (this.env.NODE_ENV === "test") {
      return false;
    }
    return this.env.PAYMENTS_TIMEOUT_ENABLED === "true";
  }

  getPaymentsTimeoutIntervalMs(): number {
    return this.env.PAYMENTS_TIMEOUT_INTERVAL_MS;
  }

  /** Parsed explicit allowlist from `CORS_ORIGIN` (trimmed, preserved casing). */
  getCorsOrigins(): string[] {
    const parsed = this.env.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (parsed.length > 0) {
      return parsed;
    }
    // Next.js dev server defaults to port 3000; avoids blocked browser calls when CORS_ORIGIN is unset locally.
    if (this.env.NODE_ENV === "development") {
      return ["http://localhost:3000", "http://127.0.0.1:3000"];
    }
    return [];
  }

  getTrustProxySetting(): number | boolean {
    if (this.env.TRUST_PROXY !== "true") {
      return false;
    }
    const hops = this.env.TRUST_PROXY_HOPS;
    return hops <= 0 ? false : hops;
  }

  getTrustedProxyCidrs(): string[] {
    return this.env.TRUSTED_PROXY_CIDRS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** When false, `X-Forwarded-Host` must not be trusted for tenant resolution (see `TenantHostResolverService`). */
  isTrustProxyEnabled(): boolean {
    return this.env.TRUST_PROXY === "true";
  }

  getTenantHostTrustModel(): {
    trustProxy: boolean;
    trustedProxyCidrs: string[];
    baseDomain: string;
  } {
    return {
      trustProxy: this.isTrustProxyEnabled(),
      trustedProxyCidrs: this.getTrustedProxyCidrs(),
      baseDomain: this.getTenantRootDomain()
    };
  }

  getCorsAllowTenantSuborigins(): boolean {
    return this.env.CORS_ALLOW_TENANT_SUBORIGINS === "true";
  }

  /**
   * Invite links and other server-generated UI URLs. Prefer explicit origin in production multi-tenant.
   */
  getPublicWebAppOrigin(): string {
    const explicit = this.env.PUBLIC_WEB_ORIGIN.trim();
    if (explicit) {
      return explicit.replace(/\/$/, "");
    }
    const first = this.getCorsOrigins()[0]?.trim();
    if (first) {
      return first.replace(/\/$/, "");
    }
    return "http://localhost:3000";
  }

  /**
   * Whether `Origin` may receive credentialed CORS responses. Undefined/empty Origin (non-browser) allowed.
   */
  isCorsOriginAllowed(originHeader: string | undefined): boolean {
    if (originHeader === undefined || originHeader.trim() === "") {
      return true;
    }

    const origin = originHeader.trim();

    const explicitNorm = new Set(
      this.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean).map((o) => o.toLowerCase())
    );
    if (explicitNorm.has(origin.toLowerCase())) {
      return true;
    }

    if (this.env.NODE_ENV === "development") {
      const devDefaults = ["http://localhost:3000", "http://127.0.0.1:3000"];
      if (devDefaults.includes(origin)) {
        return true;
      }
    }

    if (!this.getCorsAllowTenantSuborigins()) {
      return false;
    }

    const root = this.getTenantRootDomain();
    if (!root) {
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const matchesWorkspaceHost = host === root || host.endsWith(`.${root}`);
    if (!matchesWorkspaceHost) {
      return false;
    }

    if (this.env.NODE_ENV === "production") {
      const localhostLike = host === "localhost" || host.endsWith(".localhost");
      if (parsed.protocol !== "https:" && !localhostLike) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalized root domain for `{tenant}.{root}` parsing (lowercase, no port).
   * Empty disables host-based tenant resolution (`TenantHostResolverService`).
   */
  getTenantRootDomain(): string {
    return this.env.TENANT_ROOT_DOMAIN.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  }

  /** Labels blocked from becoming tenant slug lookups (lowercase). */
  getTenantHostReservedSubdomains(): Set<string> {
    return new Set(
      this.env.TENANT_HOST_RESERVED_SUBDOMAINS.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  /**
   * `NODE_ENV=test`: only explicit `TENANT_RATE_LIMIT_ENABLED=true` enables limits.
   * Other environments: enabled unless `TENANT_RATE_LIMIT_ENABLED=false`.
   */
  isTenantRateLimitEnabled(): boolean {
    const flag = this.env.TENANT_RATE_LIMIT_ENABLED;
    if (this.env.NODE_ENV === "test") {
      return flag === "true";
    }
    return flag !== "false";
  }

  getTenantRateLimitApiConfig(): {
    windowMs: number;
    perTenant: number;
    perUser: number;
    perIp: number;
  } {
    return {
      windowMs: this.env.TENANT_RATE_LIMIT_API_WINDOW_MS,
      perTenant: this.env.TENANT_RATE_LIMIT_API_PER_TENANT,
      perUser: this.env.TENANT_RATE_LIMIT_API_PER_USER,
      perIp: this.env.TENANT_RATE_LIMIT_API_PER_IP
    };
  }

  getTenantRateLimitLoginConfig(): {
    windowMs: number;
    perTenant: number;
    perIp: number;
  } {
    return {
      windowMs: this.env.TENANT_RATE_LIMIT_LOGIN_WINDOW_MS,
      perTenant: this.env.TENANT_RATE_LIMIT_LOGIN_PER_TENANT,
      perIp: this.env.TENANT_RATE_LIMIT_LOGIN_PER_IP
    };
  }

  getTenantRateLimitJobConfig(): { windowMs: number; perTenant: number } {
    return {
      windowMs: this.env.TENANT_RATE_LIMIT_JOB_WINDOW_MS,
      perTenant: this.env.TENANT_RATE_LIMIT_JOB_PER_TENANT
    };
  }

  getRateLimitFailMode(): "degraded" | "fail_closed" | "fail_open" {
    return this.env.RATE_LIMIT_FAIL_MODE;
  }

  getSchemaGuardMode(): "warn_only" | "degraded" | "fail_fast" {
    return this.env.SCHEMA_GUARD_MODE;
  }

  /** Trimmed public web origin for links in transactional email; empty when not set. */
  getFrontendBaseUrl(): string {
    return (this.env.FRONTEND_BASE_URL ?? "").trim().replace(/\/+$/, "");
  }

  /** Trimmed Resend API key; empty when not configured. */
  getResendApiKey(): string {
    return (this.env.RESEND_API_KEY ?? "").trim();
  }

  /** Trimmed `From` header for Resend; empty means EmailService uses a documented test sender. */
  getResendFrom(): string {
    return (this.env.RESEND_FROM ?? "").trim();
  }

  /** Stripe secret API key; empty means the live Stripe adapter is not selected by the factory. */
  getStripeSecretKey(): string {
    return (this.env.STRIPE_SECRET_KEY ?? "").trim();
  }

  getZibalMerchant(): string {
    return (this.env.ZIBAL_MERCHANT ?? "").trim();
  }

  getZibalCallbackUrl(): string {
    return (this.env.ZIBAL_CALLBACK_URL ?? "").trim();
  }
}
