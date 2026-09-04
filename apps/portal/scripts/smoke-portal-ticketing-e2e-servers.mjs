#!/usr/bin/env node
/**
 * API + Portal for ticketing portal E2E (Postgres / prisma driver).
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portalDir = path.join(repoRoot, "apps/portal");
const apiDir = path.join(repoRoot, "apps/api");

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev?connection_limit=32";
const databaseUrlAdmin =
  process.env.DATABASE_URL_ADMIN?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:5434/app_tour_dev";

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
        reject(new Error(`smoke-portal-ticketing-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  cwd: apiDir,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrlAdmin,
    DATABASE_URL_ADMIN: databaseUrlAdmin,
  },
  stdio: "inherit",
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const seed = spawnSync("pnpm", ["exec", "tsx", "scripts/seed-portal-ticketing-e2e-fixtures.ts"], {
  cwd: apiDir,
  env: {
    ...process.env,
    STORAGE_DRIVER: "prisma",
    DATABASE_URL: databaseUrl,
    DATABASE_URL_ADMIN: databaseUrlAdmin,
  },
  stdio: "inherit",
});
if (seed.status !== 0) {
  process.exit(seed.status ?? 1);
}

const jwtEnv = await resolveSmokeApiJwtEnv();
const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  STORAGE_DRIVER: "prisma",
  DATABASE_URL: databaseUrl,
  DATABASE_URL_ADMIN: databaseUrlAdmin,
  OPERATOR_SMOKE_E2E_SEED: "1",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  AUTH_ALLOW_DEV_BEARER: "true",
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
};

const api = spawn("node", ["--import", "tsx", "--import", "./scripts/e2e-memory-object-storage.ts", "src/main.ts"], {
  cwd: apiDir,
  env: {
    ...apiEnv,
    TICKETING_E2E_MEMORY_STORAGE: "1",
  },
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
    console.log("smoke-portal-ticketing-e2e-servers: API + portal ready (prisma)");
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
