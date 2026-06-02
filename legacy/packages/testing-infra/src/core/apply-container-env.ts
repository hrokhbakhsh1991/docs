import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { assignTestApiPort } from "./assign-test-port";
import type { JwtKeyPair, TestContainerEnvConfig } from "./types";

const DEFAULT_WEBHOOK_SECRET = "test-webhook-hmac-secret-at-least-32chars!!!!";

/**
 * Bind Testcontainers Postgres + standard API e2e env vars to `process.env`.
 * Consolidates per-spec `applyEnvForContainer` copies under `apps/api/test/e2e`.
 */
export function applyTestContainerEnv(
  db: StartedPostgreSqlContainer,
  keys: JwtKeyPair,
  config: TestContainerEnvConfig = {},
): void {
  process.env.NODE_ENV = "test";
  assignTestApiPort();
  process.env.LOG_LEVEL = "error";
  process.env.DATABASE_HOST = db.getHost();
  process.env.DATABASE_PORT = String(db.getPort());
  process.env.DATABASE_USER = db.getUsername();
  process.env.DATABASE_PASSWORD = db.getPassword();
  process.env.DATABASE_NAME = db.getDatabase();
  process.env.DATABASE_URL = db.getConnectionUri();
  process.env.JWT_PRIVATE_KEY = keys.privatePem;
  process.env.JWT_PUBLIC_KEY = keys.publicPem;
  process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? config.jwtIssuer ?? "test-issuer";
  process.env.JWT_AUDIENCE =
    process.env.JWT_AUDIENCE ?? config.jwtAudience ?? "test-audience";

  if (config.authAllowDevStaticOtp !== false) {
    process.env.AUTH_ALLOW_DEV_STATIC_OTP =
      process.env.AUTH_ALLOW_DEV_STATIC_OTP ?? "true";
  }

  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";

  if (config.disableOutboxProcessor !== false) {
    process.env.OUTBOX_POLL_INTERVAL_MS = process.env.OUTBOX_POLL_INTERVAL_MS ?? "5000";
    process.env.OUTBOX_MAX_RETRY = process.env.OUTBOX_MAX_RETRY ?? "5";
    process.env.OUTBOX_BATCH_SIZE = process.env.OUTBOX_BATCH_SIZE ?? "50";
    process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  }

  if (config.disableReconciliation !== false) {
    process.env.RECONCILIATION_ENABLED = "false";
    process.env.RECONCILIATION_INTERVAL_MS =
      process.env.RECONCILIATION_INTERVAL_MS ?? "600000";
  }

  if (config.disablePaymentsTimeout !== false) {
    process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
    process.env.PAYMENTS_TIMEOUT_INTERVAL_MS =
      process.env.PAYMENTS_TIMEOUT_INTERVAL_MS ?? "60000";
  }

  if (config.internalApiKey) {
    process.env.INTERNAL_API_KEY = config.internalApiKey;
  }

  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ?? DEFAULT_WEBHOOK_SECRET;
}
