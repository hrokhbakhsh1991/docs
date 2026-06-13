#!/usr/bin/env node
/**
 * Starts API + Web for Phase 8.4 urban smoke Playwright (SMK-P8-01..04).
 * API must be healthy before Next boots — catalog RSC fetches /urban/catalog on first paint.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensurePackageBuild,
  ensureSmokeJwtEnv,
  isSmokeProdStartEnv,
  smokeWebBaseEnv,
  waitForUrl,
} from "./smoke-ci-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");
const useProdStart = isSmokeProdStartEnv();

const urbanSmokeTenantId =
  process.env.URBAN_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000004";

if (useProdStart) {
  ensurePackageBuild(repoRoot, "@apps/api", "apps/api/dist/main.js");
  ensurePackageBuild(repoRoot, "@apps/web", "apps/web/.next/BUILD_ID");
  ensurePackageBuild(repoRoot, "@apps/marketing", "apps/marketing/.next/BUILD_ID");
  ensurePackageBuild(repoRoot, "@apps/portal", "apps/portal/.next/BUILD_ID");
}

const apiEnv = ensureSmokeJwtEnv(repoRoot, {
  ...process.env,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  URBAN_SMOKE_E2E_SEED: "1",
  URBAN_TEST_WORKSPACE_TYPE: "urban",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_BEARER: "true",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
});

const webEnv = {
  ...process.env,
  NODE_ENV: useProdStart ? "production" : "development",
  ...smokeWebBaseEnv(apiEnv),
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "00000000-0000-4000-8000-000000000403",
  TOUR_OPS_DEV_USER_ID: "00000000-0000-4000-8000-000000000401",
  TOUR_OPS_DEV_ACTOR_ROLE: "owner",
  TOUR_OPS_DEV_MEMBERSHIP_STATUS: "ACTIVE",
  ALLOW_URBAN_WEB_PLUGIN: "true",
  PORT: "3000",
};

const marketingEnv = {
  ...process.env,
  NODE_ENV: useProdStart ? "production" : "development",
  ...smokeWebBaseEnv(apiEnv),
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
  PORT: "3002",
};

const portalEnv = {
  ...process.env,
  NODE_ENV: useProdStart ? "production" : "development",
  ...smokeWebBaseEnv(apiEnv),
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "00000000-0000-4000-8000-000000000403",
  PORT: "3003",
};

const apiScript = useProdStart ? "start" : "dev";

const api = spawn("pnpm", ["--filter", "@apps/api", "run", apiScript], {
  cwd: repoRoot,
  env: apiEnv,
  stdio: "inherit",
});

let web;
let marketing;
let portal;

const webCmd = useProdStart
  ? ["exec", "next", "start", "--port", "3000"]
  : ["exec", "next", "dev", "--port", "3000"];
const marketingCmd = useProdStart
  ? ["exec", "next", "start", "--port", "3002"]
  : ["exec", "next", "dev", "--port", "3002"];
const portalCmd = useProdStart
  ? ["exec", "next", "start", "--port", "3003"]
  : ["exec", "next", "dev", "--port", "3003"];

void waitForUrl("http://127.0.0.1:3001/health")
  .then(() => {
    web = spawn("pnpm", webCmd, { cwd: webDir, env: webEnv, stdio: "inherit" });
    marketing = spawn("pnpm", marketingCmd, {
      cwd: marketingDir,
      env: marketingEnv,
      stdio: "inherit",
    });
    portal = spawn("pnpm", portalCmd, { cwd: portalDir, env: portalEnv, stdio: "inherit" });
    return waitForUrl("http://127.0.0.1:3000/", 300_000);
  })
  .then(() => waitForUrl("http://127.0.0.1:3002/", 300_000))
  .then(() => waitForUrl("http://127.0.0.1:3003/health", 300_000))
  .then(() => waitForUrl("http://shop.urban.localhost:3002/tours", 300_000))
  .then(() => waitForUrl("http://urban-owner.localhost:3000/settings/urban", 300_000))
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
