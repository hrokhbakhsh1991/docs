#!/usr/bin/env node
/**
 * API + Marketing for Lighthouse CI against the compiled Next.js output.
 * Run `pnpm run build` before starting this process.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const marketingDir = path.join(repoRoot, "apps/marketing");
const operatorSmokeTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // The port is already free.
  }
}

function waitForUrl(url, child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      child?.removeListener("error", onError);
      child?.removeListener("exit", onExit);
      callback(value);
    };
    const onError = (error) => finish(reject, error);
    const onExit = (code, signal) =>
      finish(reject, new Error(`child exited before ${url} was ready (code=${code}, signal=${signal})`));

    child?.once("error", onError);
    child?.once("exit", onExit);

    const retry = () => {
      if (Date.now() > deadline) {
        finish(reject, new Error(`lighthouse production servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    const tick = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          finish(resolve);
          return;
        }
        retry();
      });
      request.on("error", retry);
      request.setTimeout(2_000, () => {
        request.destroy();
        retry();
      });
    };
    tick();
  });
}

const jwtEnv = await resolveSmokeApiJwtEnv();
const apiEnv = {
  ...process.env,
  ...jwtEnv,
  // The marketing server is production-built; the local seeded API remains a test-only fixture.
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  DATABASE_URL: "",
  DATABASE_URL_ADMIN: "",
  REDIS_URL: "",
  OPERATOR_SMOKE_E2E_SEED: "1",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  P5_VALIDATION_WORKERS_ENABLED: "false",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const marketingEnv = {
  ...process.env,
  NODE_ENV: "production",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  PORTAL_DEV_PORT: "3003",
  MARKETING_ROBOTS_ALLOW_INDEX: "true",
};

let api;
let marketing;
const shutdown = (signal) => {
  api?.kill(signal);
  marketing?.kill(signal);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  if (!existsSync(path.join(marketingDir, ".next", "BUILD_ID"))) {
    throw new Error(
      "lighthouse production servers: missing .next/BUILD_ID; run `pnpm run build` first"
    );
  }

  freePort(3001);
  freePort(3002);
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3001/health", api);

  marketing = spawn("pnpm", ["exec", "next", "start", "--port", "3002"], {
    cwd: marketingDir,
    env: marketingEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3002/health", marketing);

  console.log("smoke-marketing-lighthouse-production-servers: production smoke ready");
  await new Promise(() => {});
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
