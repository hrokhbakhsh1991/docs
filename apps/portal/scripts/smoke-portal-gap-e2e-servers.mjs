#!/usr/bin/env node
/**
 * API + Marketing + Portal for GAP-PORTAL-01 (guest egress to marketing or catalog register).
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portalDir = path.join(repoRoot, "apps/portal");
const marketingDir = path.join(repoRoot, "apps/marketing");

const denaliSmokeTenantId = "00000000-0000-4000-8000-000000000003";
const portalSmokeHost =
  process.env.SMOKE_PORTAL_BASE_URL?.trim() || "http://denali.portal.localhost:3003";
const marketingPublicBaseUrl =
  process.env.MARKETING_PUBLIC_BASE_URL?.trim() || "http://denali.localhost:3002";

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
        reject(new Error(`smoke-portal-gap-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1_500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensurePortFree(port) {
  if (await isPortListening(port)) {
    console.log(`smoke-portal-gap-e2e-servers: port ${port} already listening — reusing`);
    return false;
  }
  freePort(port);
  await waitForPortFree(port);
  return true;
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
  throw new Error(`smoke-portal-gap-e2e-servers: port ${port} still in use`);
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  OPERATOR_SMOKE_E2E_SEED: "1",
  WRS_SMOKE_CUSTOM_APEX: "1",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const marketingEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: denaliSmokeTenantId,
  PORT: "3002",
};

const portalEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORTAL_INTERNAL_URL: "http://127.0.0.1:3003",
  TOUR_OPS_DEV_TENANT_ID: denaliSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-denali-smoke",
  PORTAL_DEV_PORT: "3003",
  MARKETING_PUBLIC_BASE_URL: marketingPublicBaseUrl,
};

const apiNeeded = await ensurePortFree(3001);
const marketingNeeded = await ensurePortFree(3002);
const portalNeeded = await ensurePortFree(3003);

let api;
let marketing;
let portal;

const startChain = async () => {
  if (apiNeeded) {
    api = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: path.join(repoRoot, "apps/api"),
      env: apiEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3001/health");
  } else {
    await waitForUrl("http://127.0.0.1:3001/health");
  }

  if (marketingNeeded) {
    marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002", "--hostname", "127.0.0.1"], {
      cwd: marketingDir,
      env: marketingEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3002/health");
  } else {
    await waitForUrl("http://127.0.0.1:3002/health");
  }

  if (portalNeeded) {
    portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
      cwd: portalDir,
      env: portalEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3003/health");
  } else {
    await waitForUrl("http://127.0.0.1:3003/health");
  }

  console.log("smoke-portal-gap-e2e-servers: API + marketing + portal ready");
  await new Promise(() => {});
};

void startChain().catch((error) => {
  console.error(error);
  if (api) api.kill("SIGTERM");
  if (marketing) marketing.kill("SIGTERM");
  if (portal) portal.kill("SIGTERM");
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`smoke-portal-gap-e2e-servers: ${signal}`);
  if (api) api.kill("SIGTERM");
  if (marketing) marketing.kill("SIGTERM");
  if (portal) portal.kill("SIGTERM");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
