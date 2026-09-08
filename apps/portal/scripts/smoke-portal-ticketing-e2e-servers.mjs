#!/usr/bin/env node
/**
 * API + Web + Portal for ticketing portal E2E (Postgres / prisma driver).
 * Web (3000) supports cross-surface TKT-BQC operator resolve via UI.
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portalDir = path.join(repoRoot, "apps/portal");
const webDir = path.join(repoRoot, "apps/web");
const apiDir = path.join(repoRoot, "apps/api");

const operatorSmokeTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";

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
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-operator-smoke",
  PORTAL_DEV_PORT: "3003",
};

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-operator-smoke",
  PORT: "3000",
};

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // Port already free or fuser unavailable.
  }
}

async function waitForPortFree(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      execSync(`lsof -ti tcp:${port}`, { stdio: "ignore" });
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch {
      return;
    }
  }
  throw new Error(`smoke-portal-ticketing-e2e-servers: port ${port} still in use`);
}

freePort(3000);
freePort(3001);
freePort(3003);
await waitForPortFree(3000);
await waitForPortFree(3001);
await waitForPortFree(3003);

const api = spawn("node", ["--import", "tsx", "--import", "./scripts/e2e-memory-object-storage.ts", "src/main.ts"], {
  cwd: apiDir,
  env: {
    ...apiEnv,
    TICKETING_E2E_MEMORY_STORAGE: "1",
  },
  stdio: "inherit",
});

let web;
let portal;

void waitForUrl("http://127.0.0.1:3001/health")
  .then(() => {
    web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000", "--hostname", "127.0.0.1"], {
      cwd: webDir,
      env: webEnv,
      stdio: "inherit",
    });
    return waitForUrl("http://127.0.0.1:3000/tickets");
  })
  .then(() => {
    portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
      cwd: portalDir,
      env: portalEnv,
      stdio: "inherit",
    });
    return waitForUrl("http://127.0.0.1:3003/health");
  })
  .then(async () => {
    console.log("smoke-portal-ticketing-e2e-servers: API + web + portal ready (prisma)");
    await new Promise(() => {});
  })
  .catch((error) => {
    console.error(error);
    api.kill("SIGTERM");
    if (web) web.kill("SIGTERM");
    if (portal) portal.kill("SIGTERM");
    process.exit(1);
  });

const shutdown = (signal) => {
  api.kill(signal);
  if (web) web.kill(signal);
  if (portal) portal.kill(signal);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
