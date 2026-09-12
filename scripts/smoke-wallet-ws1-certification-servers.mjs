#!/usr/bin/env node
/**
 * WALLET-P3C — API + Web + Portal for wallet-ws1 Postgres certification E2E.
 * Runs seed-wallet-ws1-certification before API boot (STORAGE_DRIVER=prisma).
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../apps/api/scripts/smoke-api-jwt-env.mjs";
import { cleanNextDevCache, freePort } from "./lib/smoke-cert-server-utils.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(repoRoot, "apps/api");
const webDir = path.join(repoRoot, "apps/web");
const portalDir = path.join(repoRoot, "apps/portal");

const walletTenantId =
  process.env.WALLET_WS1_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000420";
const walletWorkspaceId =
  process.env.WALLET_WS1_CERT_WORKSPACE_ID?.trim() || "00000000-0000-4000-8000-000000000421";
const walletOwnerUserId =
  process.env.WALLET_WS1_CERT_OWNER_USER_ID?.trim() || "00000000-0000-4000-8000-000000000422";

const jwtEnv = await resolveSmokeApiJwtEnv();

function ensureDevHosts() {
  // WRS canonical operator host is admin.<subdomain>.localhost (not <subdomain>.admin.localhost).
  const hosts = [
    "wallet-ws1.localhost",
    "admin.wallet-ws1.localhost",
    "portal.wallet-ws1.localhost",
    "wallet-ws1.admin.localhost",
    "wallet-ws1.portal.localhost",
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
        console.warn(`smoke-wallet-ws1-certification-servers: could not map ${host} in /etc/hosts`);
      }
    }
  }
}

function waitForUrl(url, timeoutMs = 360_000) {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-wallet-ws1-certification-servers: timeout waiting for ${url}`));
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
      "smoke-wallet-ws1-certification-servers: DATABASE_URL + DATABASE_URL_ADMIN required"
    );
  }
  const seed = spawnSync("node", ["--import", "tsx", "scripts/seed-wallet-ws1-certification.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
      STORAGE_DRIVER: "prisma",
    },
    stdio: "inherit",
  });
  if (seed.status !== 0) {
    throw new Error("smoke-wallet-ws1-certification-servers: seed failed");
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
  TOUR_OPS_DEV_TENANT_ID: walletTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: walletWorkspaceId,
  TOUR_OPS_DEV_USER_ID: walletOwnerUserId,
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
        "@app-tour/workspace-wallet-ws1",
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
        "smoke-wallet-ws1-certification-servers: guest-surface-host / workspace-sdk / wallet-ws1 build failed"
      );
    }
  } else {
    console.warn(
      "smoke-wallet-ws1-certification-servers: WALLET_CERT_SKIP_BUILD=1 — skipping package build"
    );
  }

  if (process.env.WALLET_CERT_SKIP_PORT_FREE !== "1") {
    console.warn("smoke-wallet-ws1-certification-servers: freeing 3000–3003");
    freePort(3000);
    freePort(3001);
    freePort(3003);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  if (process.env.WALLET_CERT_SKIP_SEED !== "1") {
    runSeed();
  } else {
    console.warn(
      "smoke-wallet-ws1-certification-servers: WALLET_CERT_SKIP_SEED=1 — skipping Postgres seed"
    );
  }

  const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: apiDir,
    env: apiEnv,
    stdio: "inherit",
  });
  children.push(api);
  await waitForUrl("http://127.0.0.1:3001/health");

  cleanNextDevCache(portalDir);
  const portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
    cwd: portalDir,
    env: portalEnv,
    stdio: "inherit",
  });
  children.push(portal);
  await waitForUrl("http://127.0.0.1:3003/health");

  cleanNextDevCache(webDir);
  const web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000"], {
    cwd: webDir,
    env: webEnv,
    stdio: "inherit",
  });
  children.push(web);
  await waitForUrl("http://127.0.0.1:3000/health");
  console.log("smoke-wallet-ws1-certification-servers: API + web + portal ready (prisma)");
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
