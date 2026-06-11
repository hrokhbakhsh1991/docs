#!/usr/bin/env node
/**
 * Starts API + Web for Phase 8.4 urban smoke Playwright (SMK-P8-01..04).
 * API must be healthy before Next boots — catalog RSC fetches /urban/catalog on first paint.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");

const urbanSmokeTenantId =
  process.env.URBAN_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000004";

function waitForUrl(url, timeoutMs = 300_000) {
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
        reject(new Error(`smoke-urban-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const apiEnv = {
  ...process.env,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  URBAN_SMOKE_E2E_SEED: "1",
  URBAN_TEST_WORKSPACE_TYPE: "urban",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
};

const webEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "00000000-0000-4000-8000-000000000403",
  TOUR_OPS_DEV_USER_ID: "00000000-0000-4000-8000-000000000401",
  TOUR_OPS_DEV_ACTOR_ROLE: "owner",
  TOUR_OPS_DEV_MEMBERSHIP_STATUS: "ACTIVE",
  PORT: "3000",
};

const marketingEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
};

const portalEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "00000000-0000-4000-8000-000000000403",
  PORTAL_DEV_PORT: "3003",
};

const api = spawn("pnpm", ["--filter", "@apps/api", "run", "dev"], {
  cwd: repoRoot,
  env: apiEnv,
  stdio: "inherit",
});

let web;
let marketing;
let portal;

void waitForUrl("http://127.0.0.1:3001/health")
  .then(() => {
    web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000"], {
      cwd: webDir,
      env: webEnv,
      stdio: "inherit",
    });
    marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
      cwd: marketingDir,
      env: marketingEnv,
      stdio: "inherit",
    });
    portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
      cwd: portalDir,
      env: portalEnv,
      stdio: "inherit",
    });
    return Promise.all([
      waitForUrl("http://127.0.0.1:3000/"),
      waitForUrl("http://127.0.0.1:3002/"),
      waitForUrl("http://127.0.0.1:3003/health"),
    ]);
  })
  .catch((error) => {
    console.error(error);
    api.kill("SIGTERM");
    process.exit(1);
  });

const shutdown = (signal) => {
  api.kill(signal);
  if (web) {
    web.kill(signal);
  }
  if (marketing) {
    marketing.kill(signal);
  }
  if (portal) {
    portal.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
