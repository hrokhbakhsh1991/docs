#!/usr/bin/env node
/**
 * API + Portal for BOOK-BQC member receipt upload (memory driver).
 * API NODE_ENV=development enables in-memory receipt proof storage
 * (see receipt-proof-storage.ts — test env alone returns MINIO_NOT_CONFIGURED).
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portalDir = path.join(repoRoot, "apps/portal");
const webDir = path.join(repoRoot, "apps/web");

const operatorSmokeTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";

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
        reject(new Error(`smoke-portal-booking-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

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
  throw new Error(`smoke-portal-booking-e2e-servers: port ${port} still in use`);
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  STORAGE_DRIVER: "memory",
  OPERATOR_SMOKE_E2E_SEED: "1",
  WRS_SMOKE_CUSTOM_APEX: "1",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const portalSmokeHost =
  process.env.SMOKE_PORTAL_BASE_URL?.trim() || "http://operator.portal.localhost:3003";

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
  MARKETING_PUBLIC_BASE_URL: `${portalSmokeHost.replace(/\/$/, "")}/health`,
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

freePort(3000);
freePort(3001);
freePort(3003);
await waitForPortFree(3000);
await waitForPortFree(3001);
await waitForPortFree(3003);

const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
  cwd: path.join(repoRoot, "apps/api"),
  env: apiEnv,
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
    return waitForUrl("http://127.0.0.1:3000/bookings");
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
    console.log("smoke-portal-booking-e2e-servers: API + web + portal ready");
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
  if (web) {
    web.kill(signal);
  }
  if (portal) {
    portal.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
