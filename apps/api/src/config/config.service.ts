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

  getInternalApiKey(): string {
    return this.env.INTERNAL_API_KEY;
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

  /** Parsed list of allowed CORS origins; empty means do not allow browser cross-origin requests (except dev fallback below). */
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
}
