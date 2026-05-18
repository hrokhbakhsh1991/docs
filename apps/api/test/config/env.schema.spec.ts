import assert from "node:assert/strict";
import test from "node:test";

import { envSchema } from "../../src/config/env.schema";

const baseEnv = {
  NODE_ENV: "development",
  PORT: 3001,
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  DATABASE_HOST: "localhost",
  DATABASE_PORT: 5432,
  DATABASE_USER: "u",
  DATABASE_PASSWORD: "p",
  DATABASE_NAME: "db",
  JWT_PRIVATE_KEY: "pk",
  JWT_PUBLIC_KEY: "pub",
  JWT_ISSUER: "iss",
  JWT_AUDIENCE: "aud",
  TELEGRAM_BOT_TOKEN: "tok",
  REDIS_HOST: "127.0.0.1",
  REDIS_PORT: 6379,
  PAYMENTS_WEBHOOK_SIGNING_SECRET: "test-webhook-hmac-secret-at-least-32chars!!!!"
} as const;

test("production rejects mock_provider as DEFAULT_PAYMENT_PROVIDER", () => {
  const result = envSchema.safeParse({
    ...baseEnv,
    NODE_ENV: "production",
    DEFAULT_PAYMENT_PROVIDER: "mock_provider"
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(
    result.error.issues.some((issue) => issue.path.join(".") === "DEFAULT_PAYMENT_PROVIDER")
  );
});

test("production allows stripe as DEFAULT_PAYMENT_PROVIDER", () => {
  const result = envSchema.safeParse({
    ...baseEnv,
    NODE_ENV: "production",
    DEFAULT_PAYMENT_PROVIDER: "stripe"
  });
  assert.equal(result.success, true);
});
