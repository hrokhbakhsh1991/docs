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
  /** Protects GET /internal/ops/*; compare via x-internal-api-key header. */
  INTERNAL_API_KEY: z.string().default(""),
  RECONCILIATION_ENABLED: z.enum(["true", "false"]).default("false"),
  RECONCILIATION_INTERVAL_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(600000),
  PAYMENTS_TIMEOUT_ENABLED: z.enum(["true", "false"]).default("true"),
  PAYMENTS_TIMEOUT_INTERVAL_MS: z.preprocess(
    toNumber,
    z.number().int().positive()
  ).default(60000)
});
