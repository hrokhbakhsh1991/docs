import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { LoadDotEnvTestOptions } from "./types";

function applyEnvFile(path: string, onlyIfMissing: boolean): void {
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (onlyIfMissing && key in process.env) {
      continue;
    }
    process.env[key] = value;
  }
}

/**
 * Defaults from `.env.test.example`, then optional `.env.test` overrides.
 * Mirrors `apps/api/test/e2e/bootstrap.ts` without Nest imports.
 */
export function loadDotEnvTest(options: LoadDotEnvTestOptions = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const examplePath = resolve(cwd, ".env.test.example");
  const envPath = resolve(cwd, ".env.test");
  if (existsSync(examplePath)) {
    applyEnvFile(examplePath, true);
  }
  if (existsSync(envPath)) {
    applyEnvFile(envPath, true);
  }
  if (!process.env.TENANT_ROOT_DOMAIN?.trim()) {
    process.env.TENANT_ROOT_DOMAIN = "localhost";
  }
  if (
    process.env.AUTH_ALLOW_DEV_STATIC_OTP === undefined ||
    String(process.env.AUTH_ALLOW_DEV_STATIC_OTP).trim() === ""
  ) {
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
  }
  if (
    !process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ||
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET.trim().length < 16
  ) {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
      "test-webhook-hmac-secret-at-least-32chars!!!!";
  }
  process.env.RESEND_API_KEY ??= "";
  process.env.RESEND_FROM ??= "";
  process.env.FRONTEND_BASE_URL ??= "";
}
