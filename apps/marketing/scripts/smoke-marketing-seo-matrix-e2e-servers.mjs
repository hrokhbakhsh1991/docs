#!/usr/bin/env node
/**
 * Starts API + Marketing for SMK-MKT-14/15/104 SEO matrix smoke (operator + urban + guest-club seeds).
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";
import { cleanNextDevCache } from "./smoke-next-dev-cache.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const marketingDir = path.join(repoRoot, "apps/marketing");

const operatorSmokeTenantId = "00000000-0000-4000-8000-000000000014";
const operatorPublishedTourId = "00000000-0000-4000-8000-000000000210";
const urbanSmokeTenantId = "00000000-0000-4000-8000-000000000004";
const urbanPublishedTourId = "00000000-0000-4000-8000-000000000410";

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1_500, () => done(false));
  });
}

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // port already free
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
      req.setTimeout(2_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-marketing-seo-matrix-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function keepAlive() {
  return new Promise(() => {});
}

async function probeCatalog(path, tenantId) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path,
        method: "GET",
        headers: { "x-tenant-id": tenantId },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.setTimeout(3_000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function probeMatrixSeedReady() {
  const [operatorList, operatorTour, urbanList, urbanTour] = await Promise.all([
    probeCatalog("/denali/catalog", operatorSmokeTenantId),
    probeCatalog(`/denali/catalog/${operatorPublishedTourId}`, operatorSmokeTenantId),
    probeCatalog("/urban/catalog", urbanSmokeTenantId),
    probeCatalog(`/urban/catalog/${urbanPublishedTourId}`, urbanSmokeTenantId),
  ]);
  return operatorList && operatorTour && urbanList && urbanTour;
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  DATABASE_URL: "",
  DATABASE_URL_ADMIN: "",
  REDIS_URL: "",
  OPERATOR_SMOKE_E2E_SEED: "1",
  URBAN_SMOKE_E2E_SEED: "1",
  URBAN_TEST_WORKSPACE_TYPE: "urban",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  P5_VALIDATION_WORKERS_ENABLED: "false",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const marketingEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  PORTAL_DEV_PORT: "3003",
};

let api;
let marketing;

const shutdown = (signal) => {
  if (api) {
    api.kill(signal);
  }
  if (marketing) {
    marketing.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  const forceFreshServers = process.env.PW_NO_REUSE_SERVER === "1";
  if (forceFreshServers) {
    freePort(3001);
    freePort(3002);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  let apiListening = await isPortListening(3001);
  const marketingListening = await isPortListening(3002);

  if (apiListening) {
    const seedReady = await probeMatrixSeedReady();
    if (!seedReady) {
      console.warn(
        "smoke-marketing-seo-matrix-e2e-servers: port 3001 busy without matrix smoke seed — restarting API",
      );
      freePort(3001);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      apiListening = false;
    }
  }

  if (!apiListening) {
    api = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: path.join(repoRoot, "apps/api"),
      env: apiEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3001/health");
  } else {
    console.log("smoke-marketing-seo-matrix-e2e-servers: reusing API on 3001");
    await waitForUrl("http://127.0.0.1:3001/health", 30_000);
  }

  if (!marketingListening) {
    cleanNextDevCache(marketingDir);
    marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
      cwd: marketingDir,
      env: marketingEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://operator.localhost:3002/health");
  } else {
    console.log("smoke-marketing-seo-matrix-e2e-servers: reusing marketing on 3002");
    await waitForUrl("http://operator.localhost:3002/health", 30_000);
  }

  console.log("smoke-marketing-seo-matrix-e2e-servers: API + marketing ready (matrix smoke)");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
