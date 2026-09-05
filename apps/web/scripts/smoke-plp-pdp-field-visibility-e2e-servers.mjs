#!/usr/bin/env node
/**
 * API + Denali operator web + marketing for PLP/PDP field-visibility Playwright.
 * Memory driver; same tenant (…000003) on denali.admin.localhost + denali.localhost.
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";
import { cleanNextDevCache } from "../../marketing/scripts/smoke-next-dev-cache.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const marketingDir = path.join(repoRoot, "apps/marketing");

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DENALI_SMOKE_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
const DENALI_SMOKE_WORKSPACE_ID = "ws-denali-dev";
const DENALI_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";
const readinessPort = Number(process.env.PLP_PDP_SMOKE_READY_PORT?.trim() || "3014");
const denaliAdminHost = "denali.admin.localhost:3000";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL?.trim() || "http://denali.localhost:3002";
const marketingSmokeOrigin = new URL(marketingSmokeBaseUrl);

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // port free or fuser missing
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = execSync(`lsof -ti tcp:${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      for (const pid of out.split(/\s+/).filter(Boolean)) {
        const n = Number(pid);
        if (Number.isInteger(n) && n > 1) {
          try {
            process.kill(n, attempt < 2 ? "SIGTERM" : "SIGKILL");
          } catch {
            // already gone
          }
        }
      }
    } catch {
      return;
    }
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
  throw new Error(`smoke-plp-pdp-field-visibility: port ${port} still in use`);
}

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
      req.setTimeout(60_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-plp-pdp-field-visibility: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 2_000);
    };
    tick();
  });
}

function warmMarketingPath(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: Number(marketingSmokeOrigin.port || "3002"),
        path,
        method: "GET",
        headers: {
          accept: "text/html",
          host: marketingSmokeOrigin.host,
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        reject(new Error(`warm GET ${path} failed: ${res.statusCode}`));
      },
    );
    req.on("error", reject);
    req.setTimeout(300_000, () => {
      req.destroy();
      reject(new Error(`warm GET ${path} timed out`));
    });
    req.end();
  });
}

let readinessReady = false;
const readinessServer = http.createServer((_req, res) => {
  if (readinessReady) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ready");
    return;
  }
  res.writeHead(503, { "content-type": "text/plain" });
  res.end("starting");
});
readinessServer.listen(readinessPort, "127.0.0.1");

function keepAlive() {
  return new Promise(() => {});
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "test",
  ...jwtEnv,
  STORAGE_DRIVER: "memory",
  OPERATOR_SMOKE_E2E_SEED: "1",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  P5_VALIDATION_WORKERS_ENABLED: "false",
  PUBLIC_TENANT_FALLBACK_LABEL: "denali",
  PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost",
};

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  NEXT_FONT_OFFLINE: "1",
  ALLOW_DEV_WEB_SESSION: "true",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  TOUR_OPS_DEV_TENANT_ID: DENALI_SMOKE_TENANT_ID,
  TOUR_OPS_DEV_USER_ID: DENALI_SMOKE_OWNER_USER_ID,
  TOUR_OPS_DEV_WORKSPACE_ID: DENALI_SMOKE_WORKSPACE_ID,
  TOUR_OPS_DEV_ACTOR_ROLE: "owner",
  TOUR_OPS_DEV_MEMBERSHIP_STATUS: "ACTIVE",
  DENALI_SMOKE_OWNER_USER_ID: DENALI_SMOKE_OWNER_USER_ID,
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORT: "3000",
  PUBLIC_TENANT_FALLBACK_LABEL: "denali",
  PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost",
};

const marketingEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  NEXT_FONT_OFFLINE: "1",
  ALLOW_DEV_WEB_SESSION: "true",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: DENALI_SMOKE_TENANT_ID,
  MARKETING_CATALOG_REVALIDATE_SECONDS: "0",
};

let api;
let web;
let marketing;

const shutdown = (signal) => {
  readinessServer.close();
  if (api) api.kill(signal);
  if (web) web.kill(signal);
  if (marketing) marketing.kill(signal);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  console.warn("smoke-plp-pdp-field-visibility: building workspace-denali (catalog egress dist)");
  execSync("pnpm --filter @app-tour/workspace-denali run build", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  console.warn("smoke-plp-pdp-field-visibility: freeing ports 3000–3002");
  freePort(3000);
  freePort(3001);
  freePort(3002);
  await waitForPortFree(3000);
  await waitForPortFree(3001);
  await waitForPortFree(3002);

  api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3001/health");

  cleanNextDevCache(webDir);
  web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000"], {
    cwd: webDir,
    env: webEnv,
    stdio: "inherit",
  });
  await waitForUrl(`http://${denaliAdminHost}/auth/login`);

  cleanNextDevCache(marketingDir);
  marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
    cwd: marketingDir,
    env: marketingEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3002/health");

  await warmMarketingPath("/tours");
  await warmMarketingPath(`/tours/${DENALI_SMOKE_PUBLISHED_TOUR_ID}`);

  readinessReady = true;
  console.log("smoke-plp-pdp-field-visibility: API + denali admin web + marketing ready");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
