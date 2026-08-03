#!/usr/bin/env node
/**
 * Starts API + Web for Phase 6.6 denali smoke Playwright.
 */
import { spawn, spawnSync } from "node:child_process";
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

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32";
const dbAdmin =
  process.env.DATABASE_URL_ADMIN?.trim() || "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";
const denaliSmokeTenantId =
  process.env.DENALI_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000003";
const denaliSmokeOwnerUserId =
  process.env.DENALI_SMOKE_OWNER_USER_ID?.trim() || "00000000-0000-4000-8000-000000000101";
const denaliSmokeWorkspaceId = process.env.DENALI_SMOKE_WORKSPACE_ID?.trim() || "ws-denali-dev";
const useProdStart = isSmokeProdStartEnv();

const seed = spawn("node", ["scripts/seed-denali-smoke-tenant.mjs"], {
  cwd: webDir,
  env: { ...process.env, DATABASE_URL: dbUrl, DATABASE_URL_ADMIN: dbAdmin },
  stdio: "inherit",
});

seed.on("exit", async (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  if (useProdStart) {
    ensurePackageBuild(repoRoot, "@apps/web", "apps/web/.next/BUILD_ID");
  }

  const apiEnv = ensureSmokeJwtEnv(repoRoot, {
    ...process.env,
    NODE_ENV: useProdStart ? "test" : "development",
    DATABASE_URL: dbUrl,
    STORAGE_DRIVER: "prisma",
    PORT: "3001",
    TENANT_RATE_LIMIT_ENABLED: "false",
    AUTH_ALLOW_DEV_BEARER: "true",
    AUTH_ALLOW_DEV_STATIC_OTP: "true",
    PUBLIC_TENANT_FALLBACK_LABEL: "denali",
    PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost",
  });

  const webEnv = {
    ...process.env,
    NODE_ENV: useProdStart ? "production" : "development",
    ...smokeWebBaseEnv(apiEnv),
    PUBLIC_TENANT_FALLBACK_LABEL: "denali",
    PUBLIC_TENANT_FALLBACK_HOSTS: "127.0.0.1,localhost,denali.localhost",
    TENANT_ROOT_DOMAIN: "localhost",
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
  };

  const webScript = useProdStart ? "start" : "dev";

  const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });

  try {
    await waitForUrl("http://127.0.0.1:3001/health");
  } catch (error) {
    api.kill("SIGTERM");
    console.error(error);
    process.exit(1);
  }

  const web = spawn("pnpm", ["--filter", "@apps/web", "run", webScript], {
    cwd: repoRoot,
    env: webEnv,
    stdio: "inherit",
  });

  const shutdown = (signal) => {
    api.kill(signal);
    web.kill(signal);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
});
