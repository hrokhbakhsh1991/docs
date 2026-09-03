#!/usr/bin/env node
/**
 * Phase 2 — API + Web + Portal for Denali Wallet pilot Postgres E2E.
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../apps/api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(repoRoot, "apps/api");
const webDir = path.join(repoRoot, "apps/web");
const portalDir = path.join(repoRoot, "apps/portal");

const pilotTenantId =
  process.env.DENALI_WALLET_PILOT_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000430";
const pilotWorkspaceId =
  process.env.DENALI_WALLET_PILOT_WORKSPACE_ID?.trim() || "ws-denali-wallet-pilot";
const pilotOwnerUserId =
  process.env.DENALI_WALLET_PILOT_OWNER_USER_ID?.trim() || "00000000-0000-4000-8000-000000000432";

const jwtEnv = await resolveSmokeApiJwtEnv();

function ensureDevHosts() {
  const hosts = [
    "denali-wallet-pilot.localhost",
    "admin.denali-wallet-pilot.localhost",
    "portal.denali-wallet-pilot.localhost",
    "denali.admin.localhost",
    "admin.denali.localhost",
  ];
  for (const host of hosts) {
    try {
      execSync(`getent hosts ${host}`, { stdio: "ignore" });
    } catch {
      try {
        execSync(`echo "127.0.0.1 ${host}" | sudo tee -a /etc/hosts`, { stdio: "ignore" });
      } catch {
        console.warn(`smoke-denali-wallet-pilot-servers: could not map ${host} in /etc/hosts`);
      }
    }
  }
}

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // port free or fuser missing
  }
}

function waitForUrl(url, timeoutMs = 360_000) {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-denali-wallet-pilot-servers: timeout waiting for ${url}`));
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

function runSeed() {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error(
      "smoke-denali-wallet-pilot-servers: DATABASE_URL + DATABASE_URL_ADMIN required"
    );
  }
  const seed = spawnSync("node", ["--import", "tsx", "scripts/seed-denali-wallet-pilot.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
      STORAGE_DRIVER: "prisma",
    },
    stdio: "inherit",
  });
  if (seed.status !== 0) {
    throw new Error("smoke-denali-wallet-pilot-servers: seed failed");
  }
}

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  STORAGE_DRIVER: "prisma",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  AUTH_ALLOW_DEV_BEARER: "true",
  OUTBOX_RELAY_ENABLED: "false",
  PROJECTION_AUTO_RECONCILE_ENABLED: "false",
};

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: pilotTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: pilotWorkspaceId,
  TOUR_OPS_DEV_USER_ID: pilotOwnerUserId,
  TOUR_OPS_DEV_ACTOR_ROLE: "owner",
  TOUR_OPS_DEV_MEMBERSHIP_STATUS: "ACTIVE",
  PORT: "3000",
};

const portalEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORTAL_DEV_PORT: "3003",
};
delete portalEnv.TOUR_OPS_DEV_TENANT_ID;
delete portalEnv.TOUR_OPS_DEV_WORKSPACE_ID;
delete portalEnv.TOUR_OPS_DEV_USER_ID;

const children = [];

async function start() {
  ensureDevHosts();
  if (process.env.WALLET_CERT_SKIP_BUILD !== "1") {
    const buildDeps = spawnSync(
      "pnpm",
      [
        "--filter",
        "@app-tour/guest-surface-host",
        "--filter",
        "@app-tour/workspace-sdk",
        "--filter",
        "@app-tour/guest-workspace-runtime",
        "--filter",
        "@app-tour/workspace-denali",
        "run",
        "build",
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
      }
    );
    if (buildDeps.status !== 0) {
      throw new Error(
        "smoke-denali-wallet-pilot-servers: guest-surface-host / workspace-sdk / denali build failed"
      );
    }
  }

  if (process.env.WALLET_CERT_SKIP_PORT_FREE !== "1") {
    freePort(3000);
    freePort(3001);
    freePort(3003);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  if (process.env.WALLET_CERT_SKIP_SEED !== "1") {
    runSeed();
  }

  const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: apiDir,
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
  children.push(portal);
  await waitForUrl("http://127.0.0.1:3003/health");

  const web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000"], {
    cwd: webDir,
    env: webEnv,
    stdio: "inherit",
  });
  children.push(web);
  await waitForUrl("http://127.0.0.1:3000/health");
  console.log("smoke-denali-wallet-pilot-servers: API + web + portal ready (prisma)");
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
