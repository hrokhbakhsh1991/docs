import { z } from "zod";

const toNumber = (value: unknown) => {
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return value;
};

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.preprocess(toNumber, z.number().int().positive()),
  DATABASE_URL: z.string().url(),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.preprocess(toNumber, z.number().int().positive()),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  /**
   * UNSAFE. Development-only static OTP bypass (`1234`) for local debugging.
   * Must stay `false` outside local development.
   */
  AUTH_ALLOW_DEV_STATIC_OTP: z.enum(["true", "false"]).optional(),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.preprocess(toNumber, z.number().int().positive()),
  ENABLE_SCHEDULERS: z.enum(["true", "false"]).default("true"),
  APP_RUNTIME_ROLE: z.enum(["api", "worker", "all"]).default("all"),
  JOB_SCHEDULER_JITTER_MS: z.preprocess(toNumber, z.number().int().nonnegative()).default(
    500
  ),
  OUTBOX_POLL_INTERVAL_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(5000),
  OUTBOX_MAX_RETRY: z.preprocess(toNumber, z.number().int().nonnegative()).default(
    5
  ),
  OUTBOX_BATCH_SIZE: z.preprocess(toNumber, z.number().int().positive()).default(
    50
  ),
  OUTBOX_PROCESSOR_ENABLED: z.enum(["true", "false"]).default("true"),
  /**
   * When `true`, wires {@link EVENT_PUBLISHER} to {@link InMemoryEventBus} (single-process only).
   * Default `false`: critical flows use the transactional outbox; no in-process domain dispatch.
   */
  ENABLE_IN_MEMORY_DOMAIN_EVENTS: z.enum(["true", "false"]).default("false"),
  /** Protects GET /internal/ops/*; compare via x-internal-api-key header. */
  INTERNAL_API_KEY: z.string().default(""),
  /** HMAC-SHA256 secret for POST /internal/payments/webhook (min 16 chars). */
  PAYMENTS_WEBHOOK_SIGNING_SECRET: z.string().min(16),
  /** Optional previous secret during rotation (same min length when non-empty). */
  PAYMENTS_WEBHOOK_SIGNING_SECRET_PREVIOUS: z.string().default(""),
  /** Comma-separated IPs allowed to call payment webhooks; empty = allow any (use explicit ranges in production). */
  PAYMENTS_WEBHOOK_ALLOWED_IPS: z.string().default(""),
  RECONCILIATION_ENABLED: z.enum(["true", "false"]).default("false"),
  RECONCILIATION_INTERVAL_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(600000),
  PAYMENTS_TIMEOUT_ENABLED: z.enum(["true", "false"]).default("true"),
  PAYMENTS_TIMEOUT_INTERVAL_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(60000),
  /** Comma-separated browser origins allowed by CORS (e.g. https://app.example.com,https://admin.example.com). Empty disables cross-origin in production/test; in development localhost:3000 and 127.0.0.1:3000 are allowed by ConfigService.getCorsOrigins(). */
  CORS_ORIGIN: z.string().default(""),

  /**
   * When `true`, browser origins whose hostname equals `TENANT_ROOT_DOMAIN` or is a subdomain of it
   * (e.g. `https://acme.app.example.com` when root is `app.example.com`) are allowed without listing each tenant.
   * Production requires `https:` except `localhost` / `*.localhost`.
   */
  CORS_ALLOW_TENANT_SUBORIGINS: z.enum(["true", "false"]).default("false"),

  /**
   * Enables trusting proxy-forwarded host headers for tenant resolution.
   * When `false`, `x-forwarded-host` is ignored.
   */
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  /**
   * Express `trust proxy` hop count (how many reverse proxies terminate TLS before Node).
   * `0` disables trusting `X-Forwarded-*`; typical edge→API is `1`; CDN+ingress may need `2+`.
   */
  TRUST_PROXY_HOPS: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? 1 : toNumber(v)),
    z.number().int().min(0).max(31)
  ),
  /**
   * Comma-separated trusted reverse proxy CIDRs/IPs for interpreting X-Forwarded-For.
   * Empty disables XFF trust entirely.
   */
  TRUSTED_PROXY_CIDRS: z.string().default(""),

  /**
   * Canonical base URL for server-built invite links (`PUBLIC_WEB_ORIGIN` overrides guessing from `CORS_ORIGIN`).
   */
  PUBLIC_WEB_ORIGIN: z.string().default(""),

  /**
   * Host suffix after the tenant label for subdomain routing (e.g. `app.example.com` so requests to
   * `acme.app.example.com` resolve tenant slug `acme`). Empty string disables host-based tenant resolution.
   */
  TENANT_ROOT_DOMAIN: z.string().default(""),

  /**
   * Comma-separated subdomain labels (lowercase) that never map to a tenant (`www`, `api`, …).
   */
  TENANT_HOST_RESERVED_SUBDOMAINS: z
    .string()
    .default(
      "www,api,app,mail,ftp,cdn,static,assets,localhost,staging,admin,internal,root"
    ),

  /**
   * Redis sliding-window tenant abuse limits.
   * Omitted or non-`false` → enabled in non-test; in `NODE_ENV=test`, only `true` enables (see ConfigService).
   */
  TENANT_RATE_LIMIT_ENABLED: z.enum(["true", "false"]).optional(),
  TENANT_RATE_LIMIT_API_WINDOW_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(60_000),
  TENANT_RATE_LIMIT_API_PER_TENANT: z.preprocess(toNumber, z.number().int().positive()).default(
    6000
  ),
  TENANT_RATE_LIMIT_API_PER_USER: z.preprocess(toNumber, z.number().int().positive()).default(
    1200
  ),
  TENANT_RATE_LIMIT_API_PER_IP: z.preprocess(toNumber, z.number().int().positive()).default(3000),

  TENANT_RATE_LIMIT_LOGIN_WINDOW_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(60_000),
  TENANT_RATE_LIMIT_LOGIN_PER_TENANT: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(60),
  TENANT_RATE_LIMIT_LOGIN_PER_IP: z.preprocess(toNumber, z.number().int().positive()).default(30),

  TENANT_RATE_LIMIT_JOB_WINDOW_MS: z.preprocess(toNumber, z.number().int().positive()).default(
    60_000
  ),
  TENANT_RATE_LIMIT_JOB_PER_TENANT: z.preprocess(toNumber, z.number().int().positive()).default(120),
  /**
   * Behavior when Redis is unavailable during rate-limit evaluation:
   * - degraded: in-memory token bucket fallback (default, safer than fail-open)
   * - fail_closed: deny traffic when Redis errors
   * - fail_open: allow traffic when Redis errors
   */
  RATE_LIMIT_FAIL_MODE: z.enum(["degraded", "fail_closed", "fail_open"]).default("degraded")
  ,
  /**
   * Runtime DB schema drift reaction:
   * - warn_only: log only (default)
   * - degraded: keep serving but mark health as degraded
   * - fail_fast: abort startup when required columns are missing
   */
  SCHEMA_GUARD_MODE: z.enum(["warn_only", "degraded", "fail_fast"]).default("warn_only"),

  /**
   * Optional web app origin for email deep links (e.g. `https://app.example.com`).
   * Trailing slash is ignored. Empty skips verify links in outbound mail.
   */
  FRONTEND_BASE_URL: z.string().default(""),

  /** Resend API key; empty disables outbound email (EmailService no-ops). */
  RESEND_API_KEY: z.string().default(""),
  /** Verified sender, e.g. `TourOps <mail@yourdomain.com>`. Empty uses Resend onboarding sender while testing. */
  RESEND_FROM: z.string().default(""),

  /**
   * Stripe secret API key (`sk_test_…` / `sk_live_…`). When empty, `paymentProvider=stripe` uses the
   * in-process placeholder adapter instead of the live SDK.
   */
  STRIPE_SECRET_KEY: z.string().default(""),

  /** Zibal `merchant` id (digits). Required for `paymentProvider=zibal` when using the real adapter. */
  ZIBAL_MERCHANT: z.string().default(""),

  /**
   * Absolute HTTPS callback URL registered with Zibal (buyer return + verification handoff).
   * Required for `paymentProvider=zibal` when using the real adapter.
   */
  ZIBAL_CALLBACK_URL: z.string().default(""),

  /**
   * Payment-gateway idempotency store: `redis` (durable, multi-instance) or `memory` (single process).
   * When unset, defaults to `memory` when `NODE_ENV=test`, otherwise `redis`.
   */
  PAYMENT_GATEWAY_IDEMPOTENCY_STORE: z.preprocess(
    (v: unknown) => {
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      if (s === "redis" || s === "memory") {
        return s;
      }
      return process.env.NODE_ENV === "test" ? "memory" : "redis";
    },
    z.enum(["redis", "memory"])
  )
});
