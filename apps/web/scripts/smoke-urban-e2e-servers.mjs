#!/usr/bin/env node
/**
 * Starts API + Web for Phase 8.4 urban smoke Playwright (SMK-P8-01..04).
 * Playwright gates on `127.0.0.1:3000/health` — avoid polling heavy `/` routes.
 *
 * Ephemeral RS256 from resolveSmokeApiJwtEnv() is minted this process. Reusing
 * API/web/portal from a prior run signs cookies with a different key →
 * invalid_signature → guest OTP loop (SMK-P8-02). Always free 3000–3003.
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");

const urbanSmokeTenantId =
  process.env.URBAN_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000004";

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  URBAN_SMOKE_E2E_SEED: "1",
  URBAN_TEST_WORKSPACE_TYPE: "urban",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  // Dev bearer is test-only (AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST). Must not
  // start via `pnpm run dev` which hardcodes NODE_ENV=development.
  AUTH_ALLOW_DEV_BEARER: "true",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  // Wave H — urban settings/host loads @app-tour/workspace-urban via gated loaders.
  ALLOW_URBAN_WEB_PLUGIN: "true",
  ALLOW_DENALI_WEB_PLUGIN: process.env.ALLOW_DENALI_WEB_PLUGIN ?? "true",
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
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
};

const portalEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: urbanSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "00000000-0000-4000-8000-000000000403",
  PORTAL_DEV_PORT: "3003",
};

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // fuser missing (Cloud image) or port already free
  }
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      const n = Number(pid);
      if (Number.isInteger(n) && n > 1) {
        try {
          process.kill(n, "SIGTERM");
        } catch {
          // already gone
        }
      }
    }
  } catch {
    // nothing listening
  }
}

function waitForUrl(url, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-urban-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 1_500);
    };
    const tick = () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      const req = http.get(url, (res) => {
        inFlight = false;
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", () => {
        inFlight = false;
        retry();
      });
      req.setTimeout(30_000, () => {
        req.destroy();
        inFlight = false;
        retry();
      });
    };
    tick();
  });
}

const children = [];

async function start() {
  const build = spawnSync("pnpm", ["--filter", "@app-tour/workspace-urban", "run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    throw new Error("smoke-urban-e2e-servers: workspace-urban build failed");
  }

  console.warn("smoke-urban-e2e-servers: freeing 3000–3003 so JWT matches portal/web");
  freePort(3000);
  freePort(3001);
  freePort(3002);
  freePort(3003);
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  // Honor apiEnv.NODE_ENV=test — do not use `pnpm run dev` (forces development).
  // Do not pass --env-file=.env.local: that file can inject a second AUTH_JWT_PUBLIC_KEY.
  const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });
  children.push(api);
  await waitForUrl("http://127.0.0.1:3001/health");

  const portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
    cwd: portalDir,
    env: portalEnv,
    stdio: "inherit",
  });
  const marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
    cwd: marketingDir,
    env: marketingEnv,
    stdio: "inherit",
  });
  children.push(portal, marketing);
  await Promise.all([
    waitForUrl("http://127.0.0.1:3002/health"),
    waitForUrl("http://127.0.0.1:3003/health"),
  ]);

  // Web last — Playwright webServer.url is :3000/health; starting it after
  // portal/marketing avoids SMK-P8 racing a cold :3002/:3003 compile.
  const web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000"], {
    cwd: webDir,
    env: webEnv,
    stdio: "inherit",
  });
  children.push(web);
  await waitForUrl("http://127.0.0.1:3000/health");
  console.log("smoke-urban-e2e-servers: API + web + marketing + portal ready");
}

void start().catch((error) => {
  console.error(error);
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(1);
});

const shutdown = (signal) => {
  for (const child of children) {
    child.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
