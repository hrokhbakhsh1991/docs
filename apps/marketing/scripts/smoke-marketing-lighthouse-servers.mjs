#!/usr/bin/env node
/**
 * API + Marketing for Lighthouse CI — uses next dev (reliable local smoke).
 */
import { execSync, spawn } from "node:child_process";
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
    // already free
  }
}

function waitForUrl(url, timeoutMs = 360_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-marketing-lighthouse-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function keepAlive() {
  return new Promise(() => {});
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
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
delete apiEnv.PW_NO_REUSE_SERVER;

const marketingEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  PORTAL_DEV_PORT: "3003",
  MARKETING_ROBOTS_ALLOW_INDEX: "true",
};
delete marketingEnv.PW_NO_REUSE_SERVER;

let api;
let marketing;

const shutdown = (signal) => {
  if (api) {
    api.kill(signal);
  }
  if (marketing) {
    marketing.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  freePort(3001);
  freePort(3002);
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3001/health");

  marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
    cwd: marketingDir,
    env: marketingEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3002/health");

  console.log("smoke-marketing-lighthouse-servers: lighthouse smoke ready");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
