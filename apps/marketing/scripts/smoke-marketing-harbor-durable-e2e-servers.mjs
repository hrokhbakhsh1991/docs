#!/usr/bin/env node
/**
 * PSR-6c6b — Durable Harbor G1 Playwright server harness (seed OFF).
 *
 * Does NOT force HARBOR_SMOKE_E2E_SEED. Requires durable Postgres env.
 * Does NOT start servers unless env is valid — fail closed before spawn.
 *
 * Live Playwright still requires Architect YES + published tour rows.
 *
 * Contrast: smoke-marketing-harbor-e2e-servers.mjs (seed+memory) remains the
 * default for test:smoke:harbor.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";
import { cleanNextDevCache } from "./smoke-next-dev-cache.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");

const harborSmokeTenantId =
  process.env.HARBOR_SMOKE_TENANT_ID?.trim() || "fbdcae8a-2cd8-4c2c-898c-f408bd51321a";
const marketingSmokeHost = "harbor.localhost:3002";
const portalSmokeHost = "portal.harbor.localhost:3003";
const forceFreshServers = process.env.PW_NO_REUSE_SERVER === "1";

function fail(msg) {
  console.error(`smoke-marketing-harbor-durable-e2e-servers: FAIL — ${msg}`);
  process.exit(2);
}

function assertDurableEnv() {
  const seed = process.env.HARBOR_SMOKE_E2E_SEED?.trim();
  if (seed === "1" || seed === "true") {
    fail(
      "HARBOR_SMOKE_E2E_SEED must be unset/0 for durable harness (use smoke-marketing-harbor-e2e-servers.mjs for seed path)",
    );
  }
  if (!process.env.DATABASE_URL?.trim()) {
    fail("DATABASE_URL required for durable Harbor e2e");
  }
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    fail("DATABASE_URL_ADMIN required for durable Harbor e2e");
  }
  const driver = (process.env.STORAGE_DRIVER || "prisma").trim().toLowerCase();
  if (driver === "memory") {
    fail("STORAGE_DRIVER=memory forbidden in durable harness");
  }
}

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
        reject(
          new Error(
            `smoke-marketing-harbor-durable-e2e-servers: timeout waiting for ${url}`,
          ),
        );
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function probeDurableCatalogNon501() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: "/harbor/catalog",
        method: "GET",
        headers: { "x-tenant-id": harborSmokeTenantId },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          // Durable path: 200 with list (maybe empty) — never 501
          resolve(res.statusCode === 200);
        });
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

function keepAlive() {
  return new Promise(() => {});
}

assertDurableEnv();

const jwtEnv = await resolveSmokeApiJwtEnv();
const storageDriver = (process.env.STORAGE_DRIVER || "prisma").trim();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: process.env.NODE_ENV || "test",
  STORAGE_DRIVER: storageDriver,
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  P5_VALIDATION_WORKERS_ENABLED: "false",
};
// Explicitly do not set HARBOR_SMOKE_E2E_SEED
delete apiEnv.HARBOR_SMOKE_E2E_SEED;

const portalEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORTAL_INTERNAL_URL: "http://127.0.0.1:3003",
  TOUR_OPS_DEV_TENANT_ID: harborSmokeTenantId,
  PORTAL_DEV_PORT: "3003",
  MARKETING_PUBLIC_BASE_URL: `http://${marketingSmokeHost}`,
};

const marketingEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: harborSmokeTenantId,
  PORTAL_DEV_PORT: "3003",
};

let api;
let marketing;
let portal;

const shutdown = (signal) => {
  if (api) api.kill(signal);
  if (portal) portal.kill(signal);
  if (marketing) marketing.kill(signal);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  // Dry-run mode for smokes: validate env contract only
  if (process.env.HARBOR_DURABLE_E2E_DRY_RUN === "1") {
    console.log(
      "smoke-marketing-harbor-durable-e2e-servers: DRY_RUN OK — env contract valid; servers not started",
    );
    process.exit(0);
  }

  if (forceFreshServers) {
    console.warn(
      "smoke-marketing-harbor-durable-e2e-servers: PW_NO_REUSE_SERVER=1 — will not kill ports automatically (ops-owned); ensure 3001–3003 free",
    );
  }

  let apiListening = await isPortListening(3001);
  const marketingListening = await isPortListening(3002);
  const portalListening = await isPortListening(3003);

  if (!apiListening) {
    api = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: path.join(repoRoot, "apps/api"),
      env: apiEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3001/health");
  } else {
    console.log("smoke-marketing-harbor-durable-e2e-servers: reusing API on 3001");
    await waitForUrl("http://127.0.0.1:3001/health", 30_000);
  }

  const catalogOk = await probeDurableCatalogNon501();
  if (!catalogOk) {
    fail(
      "GET /harbor/catalog did not return 200 under durable env (is product host configured? seed accidentally on?)",
    );
  }

  if (!portalListening) {
    cleanNextDevCache(portalDir);
    portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
      cwd: portalDir,
      env: portalEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3003/health");
  } else {
    console.log("smoke-marketing-harbor-durable-e2e-servers: reusing portal on 3003");
  }

  if (!marketingListening) {
    cleanNextDevCache(marketingDir);
    marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
      cwd: marketingDir,
      env: marketingEnv,
      stdio: "inherit",
    });
    await waitForUrl(`http://${marketingSmokeHost}/health`);
  } else {
    console.log("smoke-marketing-harbor-durable-e2e-servers: reusing marketing on 3002");
  }

  console.log(
    "smoke-marketing-harbor-durable-e2e-servers: API + portal + marketing ready (durable G1; seed off)",
  );
  console.log(
    "smoke-marketing-harbor-durable-e2e-servers: ensure a published Harbor tour exists for tenant",
    harborSmokeTenantId,
  );
  await keepAlive();
} catch (err) {
  console.error(err);
  shutdown("SIGTERM");
  process.exit(1);
}
