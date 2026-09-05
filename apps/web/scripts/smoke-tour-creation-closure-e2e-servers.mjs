#!/usr/bin/env node
/**
 * API + operator web + marketing + portal for tour-creation-closure Playwright.
 * Tenant 014 — admin.operator.localhost / operator.localhost / operator.portal.localhost.
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";
import { resolveOperatorSmokeOwnerMobile } from "./operator-smoke-identity.mjs";
import { cleanNextDevCache } from "../../marketing/scripts/smoke-next-dev-cache.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const operatorSmokeOwnerMobile = resolveOperatorSmokeOwnerMobile();
const readinessPort = Number(process.env.TOUR_CLOSURE_SMOKE_READY_PORT?.trim() || "3016");

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // port free
  }
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
      req.setTimeout(5_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-tour-creation-closure: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

let readinessReady = false;
const readinessServer = http.createServer((_req, res) => {
  if (!readinessReady) {
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("warming\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ready\n");
});
readinessServer.listen(readinessPort, "127.0.0.1");

let api;
let web;
let marketing;
let portal;

const shutdown = (signal) => {
  readinessServer.close();
  for (const proc of [web, marketing, portal, api]) {
    if (proc) {
      proc.kill(signal);
    }
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  execSync("pnpm --filter @app-tour/catalog-registration-flow-ui run build", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  for (const port of [3000, 3001, 3002, 3003]) {
    freePort(port);
  }

  const jwtEnv = await resolveSmokeApiJwtEnv();

  const apiEnv = {
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "test",
    STORAGE_DRIVER: "memory",
    OPERATOR_SMOKE_E2E_SEED: "1",
    OPERATOR_OWNER_MOBILE: operatorSmokeOwnerMobile,
    AUTH_ALLOW_DEV_STATIC_OTP: "true",
    PORT: "3001",
    HOST: "127.0.0.1",
    TENANT_RATE_LIMIT_ENABLED: "false",
    P5_VALIDATION_WORKERS_ENABLED: "false",
    PROJECTION_AUTO_RECONCILE_ENABLED: "false",
  };
  delete apiEnv.DATABASE_URL;
  delete apiEnv.DATABASE_URL_ADMIN;

  const webEnv = {
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "development",
    ALLOW_DEV_WEB_SESSION: "true",
    ALLOW_DENALI_WEB_PLUGIN: "true",
    TOUR_OPS_DEV_TENANT_ID: OPERATOR_SMOKE_TENANT_ID,
    TOUR_OPS_API_URL: "http://127.0.0.1:3001",
    API_INTERNAL_URL: "http://127.0.0.1:3001",
    PORT: "3000",
  };

  const portalEnv = {
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "development",
    ALLOW_DEV_WEB_SESSION: "true",
    TOUR_OPS_API_URL: "http://127.0.0.1:3001",
    API_INTERNAL_URL: "http://127.0.0.1:3001",
    PORTAL_INTERNAL_URL: "http://127.0.0.1:3003",
    TOUR_OPS_DEV_TENANT_ID: OPERATOR_SMOKE_TENANT_ID,
    TOUR_OPS_DEV_WORKSPACE_ID: "ws-operator-smoke",
    PORTAL_DEV_PORT: "3003",
  };

  const marketingEnv = {
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "development",
    ALLOW_DEV_WEB_SESSION: "true",
    TOUR_OPS_API_URL: "http://127.0.0.1:3001",
    TOUR_OPS_DEV_TENANT_ID: OPERATOR_SMOKE_TENANT_ID,
    PORTAL_DEV_PORT: "3003",
  };

  api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3001/health");

  web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000", "--hostname", "127.0.0.1"], {
    cwd: webDir,
    env: webEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3000/auth/login");

  cleanNextDevCache(portalDir);
  portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
    cwd: portalDir,
    env: portalEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3003/health");

  cleanNextDevCache(marketingDir);
  marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
    cwd: marketingDir,
    env: marketingEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3002/health");

  readinessReady = true;
  console.log("smoke-tour-creation-closure-e2e-servers: API + web + marketing + portal ready");
  await new Promise(() => {});
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
