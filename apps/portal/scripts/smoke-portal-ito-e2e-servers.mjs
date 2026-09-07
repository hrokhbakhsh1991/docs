#!/usr/bin/env node
/**
 * Starts API + Portal for ITO member execution summary Playwright (Postgres).
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portalDir = path.join(repoRoot, "apps/portal");

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5432/app_tour_dev?connection_limit=32";
const dbAdmin =
  process.env.DATABASE_URL_ADMIN?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_tour_dev";
const denaliSmokeTenantId =
  process.env.DENALI_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000003";

function waitForUrl(url, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url)
        .then((res) => {
          if (res.status < 500) {
            resolve();
            return;
          }
          retry();
        })
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-portal-ito-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const seed = spawnSync(
  "pnpm",
  [
    "--filter",
    "@apps/api",
    "exec",
    "node",
    "--import",
    "tsx",
    "scripts/seed-denali-ito-e2e-fixtures.ts",
  ],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DATABASE_URL_ADMIN: dbAdmin,
      STORAGE_DRIVER: "prisma",
      NODE_ENV: "development",
    },
    stdio: "inherit",
  },
);

if (seed.status !== 0) {
  process.exit(seed.status ?? 1);
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  DATABASE_URL: dbUrl,
  DATABASE_URL_ADMIN: dbAdmin,
  STORAGE_DRIVER: "prisma",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_BEARER: "true",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  PUBLIC_TENANT_FALLBACK_LABEL: "denali",
  PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost,portal.denali.localhost",
};

const portalEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORTAL_INTERNAL_URL: "http://127.0.0.1:3003",
  PORTAL_DEV_PORT: "3003",
  TOUR_OPS_DEV_TENANT_ID: denaliSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-denali-dev",
  MARKETING_PUBLIC_BASE_URL: "http://denali.localhost:3002",
};

const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
  cwd: path.join(repoRoot, "apps/api"),
  env: apiEnv,
  stdio: "inherit",
});

let portal;

void waitForUrl("http://127.0.0.1:3001/health")
  .then(() => {
    portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
      cwd: portalDir,
      env: portalEnv,
      stdio: "inherit",
    });
    return waitForUrl("http://127.0.0.1:3003/health");
  })
  .then(async () => {
    console.log("smoke-portal-ito-e2e-servers: API + portal ready");
    await new Promise(() => {});
  })
  .catch((error) => {
    console.error(error);
    api.kill("SIGTERM");
    if (portal) portal.kill("SIGTERM");
    process.exit(1);
  });

const shutdown = (signal) => {
  api.kill(signal);
  if (portal) portal.kill(signal);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
