#!/usr/bin/env node
/**
 * Starts API + Web for Phase 6.6 denali smoke Playwright.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const denaliSmokeWorkspaceId =
  process.env.DENALI_SMOKE_WORKSPACE_ID?.trim() || "ws-denali-dev";
/** CI runs `pnpm build` before smoke; dev-mode first compile of /tours/new exceeds Playwright goto budget. */
const useProdStart =
  process.env.SMOKE_USE_PROD_START === "1" ||
  process.env.CI === "true" ||
  process.env.CI === "1";

function parseBootstrapJwtLines(stdout) {
  const env = {};
  for (const line of stdout.split("\n")) {
    if (line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\n/g, "\n");
    }
    env[key] = val;
  }
  return env;
}

/** GHA smoke has no apps/api/.env.local — ephemeral RS256 keys for verify-otp/session JWT. */
function ensureSmokeJwtEnv(baseEnv) {
  if (baseEnv.AUTH_JWT_PRIVATE_KEY?.trim()) {
    return baseEnv;
  }
  const result = spawnSync("pnpm", ["--filter", "@apps/api", "run", "bootstrap:dev-jwt"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return { ...baseEnv, ...parseBootstrapJwtLines(result.stdout) };
}

function waitForUrl(url, timeoutMs = 180_000) {
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
        reject(new Error(`smoke-denali-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const seed = spawn("node", ["scripts/seed-denali-smoke-tenant.mjs"], {
  cwd: webDir,
  env: { ...process.env, DATABASE_URL: dbUrl, DATABASE_URL_ADMIN: dbAdmin },
  stdio: "inherit",
});

seed.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  if (useProdStart && !existsSync(path.join(webDir, ".next", "BUILD_ID"))) {
    const build = spawnSync("pnpm", ["--filter", "@apps/web", "run", "build"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    if (build.status !== 0) {
      process.exit(build.status ?? 1);
    }
  }

  const apiEnv = ensureSmokeJwtEnv({
    ...process.env,
    NODE_ENV: useProdStart ? "test" : "development",
    DATABASE_URL: dbUrl,
    STORAGE_DRIVER: "prisma",
    PORT: "3001",
    TENANT_RATE_LIMIT_ENABLED: "false",
    AUTH_ALLOW_DEV_BEARER: "true",
    AUTH_ALLOW_DEV_STATIC_OTP: "true",
  });

  const webEnv = {
    ...process.env,
    NODE_ENV: useProdStart ? "production" : "development",
    SESSION_COOKIE_SECURE: "false",
    AUTH_JWT_PUBLIC_KEY: apiEnv.AUTH_JWT_PUBLIC_KEY,
    AUTH_JWT_ISSUER: apiEnv.AUTH_JWT_ISSUER ?? "tour-ops",
    AUTH_JWT_AUDIENCE: apiEnv.AUTH_JWT_AUDIENCE ?? "tour-ops-api",
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
  };

  const apiScript = useProdStart ? "start" : "dev";
  const webScript = useProdStart ? "start" : "dev";

  const api = spawn("pnpm", ["--filter", "@apps/api", "run", apiScript], {
    cwd: repoRoot,
    env: apiEnv,
    stdio: "inherit",
  });

  const web = spawn("pnpm", ["--filter", "@apps/web", "run", webScript], {
    cwd: repoRoot,
    env: webEnv,
    stdio: "inherit",
  });

  void waitForUrl("http://127.0.0.1:3001/health")
    .then(() => waitForUrl("http://127.0.0.1:3000/"))
    .then(() => waitForUrl("http://127.0.0.1:3000/tours/new", 300_000));

  const shutdown = (signal) => {
    api.kill(signal);
    web.kill(signal);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
});
