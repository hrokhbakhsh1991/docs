#!/usr/bin/env node
/**
 * API + Web for Denali operator engagement E2E (Postgres / prisma driver).
 * Uses canonical `pnpm --filter @apps/web run dev` (predev guards included).
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const apiDir = path.join(repoRoot, "apps/api");

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5432/app_tour_dev?connection_limit=32";
const databaseUrlAdmin =
  process.env.DATABASE_URL_ADMIN?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_tour_dev";
const denaliSmokeTenantId =
  process.env.DENALI_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000003";
const denaliSmokeOwnerUserId =
  process.env.DENALI_SMOKE_OWNER_USER_ID?.trim() || "00000000-0000-4000-8000-000000000101";
const denaliSmokeWorkspaceId = process.env.DENALI_SMOKE_WORKSPACE_ID?.trim() || "ws-denali-dev";
const denaliSmokeCanonicalHost = "denali.admin.localhost:3000";

function waitForUrl(url, timeoutMs = 600_000) {
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
      req.setTimeout(180_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-operator-engagement-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  cwd: apiDir,
  env: { ...process.env, DATABASE_URL: databaseUrlAdmin, DATABASE_URL_ADMIN: databaseUrlAdmin },
  stdio: "inherit",
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const seed = spawnSync(
  "pnpm",
  ["exec", "tsx", "scripts/seed-operator-engagement-e2e-fixtures.ts"],
  {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      STORAGE_DRIVER: "prisma",
      DATABASE_URL: databaseUrl,
      DATABASE_URL_ADMIN: databaseUrlAdmin,
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
  DATABASE_URL: databaseUrl,
  DATABASE_URL_ADMIN: databaseUrlAdmin,
  STORAGE_DRIVER: "prisma",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  AUTH_ALLOW_DEV_BEARER: "true",
  PORT: "3001",
  HOST: "127.0.0.1",
  TENANT_RATE_LIMIT_ENABLED: "false",
  PUBLIC_TENANT_FALLBACK_LABEL: "denali",
  PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost",
};

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  TOUR_OPS_DEV_TENANT_ID: denaliSmokeTenantId,
  TOUR_OPS_DEV_USER_ID: denaliSmokeOwnerUserId,
  TOUR_OPS_DEV_WORKSPACE_ID: denaliSmokeWorkspaceId,
  TOUR_OPS_DEV_ACTOR_ROLE: "owner",
  TOUR_OPS_DEV_MEMBERSHIP_STATUS: "ACTIVE",
  DENALI_SMOKE_OWNER_USER_ID: denaliSmokeOwnerUserId,
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORT: "3000",
  PUBLIC_TENANT_FALLBACK_LABEL: "denali",
  PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost",
};

const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
  cwd: apiDir,
  env: apiEnv,
  stdio: "inherit",
});
await waitForUrl("http://127.0.0.1:3001/health");

const web = spawn("pnpm", ["--filter", "@apps/web", "run", "dev"], {
  cwd: repoRoot,
  env: webEnv,
  stdio: "inherit",
});
await waitForUrl(`http://${denaliSmokeCanonicalHost}/auth/login`);
await waitForUrl(`http://${denaliSmokeCanonicalHost}/engagement`);

console.log("smoke-operator-engagement-e2e-servers: API + web ready");

process.on("SIGINT", () => {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
});
process.on("SIGTERM", () => {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
});

await new Promise(() => {});
