#!/usr/bin/env node
/**
 * Starts API + Portal + Marketing for SMK-MKT-* Playwright smoke.
 * Registration CTA targets apps/portal (DEC-P11-014).
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");

const operatorSmokeTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";
const operatorSmokeOwnerUserId = "00000000-0000-4000-8000-000000000101";
const operatorSmokeSeedTourTitle = "North Ridge Trek";
const operatorSmokeSeedTourId = "00000000-0000-4000-8000-000000000210";
const forceFreshServers = process.env.PW_NO_REUSE_SERVER === "1";

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
    // port already free or fuser unavailable
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
        reject(new Error(`smoke-marketing-e2e-servers: timeout waiting for ${url}`));
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

/** Refuse stale API reuse when operator smoke catalog seed is missing. */
async function probeOperatorSmokeSeedReady() {
  const headers = {
    "x-tenant-id": operatorSmokeTenantId,
    "x-authenticated-tenant-id": operatorSmokeTenantId,
    "x-user-id": operatorSmokeOwnerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-smoke",
  };
  const listReady = await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: "/tours?view=operator&limit=5",
        method: "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const items = Array.isArray(body.items) ? body.items : [];
            resolve(
              items.some(
                (row) =>
                  typeof row?.title === "string" && row.title.trim() === operatorSmokeSeedTourTitle
              )
            );
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.setTimeout(3_000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
  if (!listReady) {
    return false;
  }
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: `/denali/catalog/${operatorSmokeSeedTourId}`,
        method: "GET",
        headers: { "x-tenant-id": operatorSmokeTenantId },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.setTimeout(3_000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
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
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  P5_VALIDATION_WORKERS_ENABLED: "false",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const portalEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-operator-smoke",
  PORTAL_DEV_PORT: "3003",
};

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
let portal;

const shutdown = (signal) => {
  if (api) {
    api.kill(signal);
  }
  if (portal) {
    portal.kill(signal);
  }
  if (marketing) {
    marketing.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  if (forceFreshServers) {
    console.warn("smoke-marketing-e2e-servers: PW_NO_REUSE_SERVER=1 — freeing ports 3001–3003");
    freePort(3001);
    freePort(3002);
    freePort(3003);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  let apiListening = await isPortListening(3001);
  const portalListening = await isPortListening(3003);
  const marketingListening = await isPortListening(3002);

  if (apiListening) {
    const seedReady = await probeOperatorSmokeSeedReady();
    if (!seedReady) {
      console.warn(
        "smoke-marketing-e2e-servers: port 3001 busy without operator smoke seed — restarting API"
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
    console.log("smoke-marketing-e2e-servers: reusing API on 3001");
    await waitForUrl("http://127.0.0.1:3001/health", 30_000);
  }

  if (!portalListening) {
    portal = spawn("pnpm", ["exec", "next", "dev", "--port", "3003"], {
      cwd: portalDir,
      env: portalEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3003/health");
  } else {
    console.log("smoke-marketing-e2e-servers: reusing portal on 3003");
    await waitForUrl("http://127.0.0.1:3003/health", 30_000);
  }

  if (!marketingListening) {
    marketing = spawn("pnpm", ["exec", "next", "dev", "--port", "3002"], {
      cwd: marketingDir,
      env: marketingEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3002/health");
  } else {
    console.log("smoke-marketing-e2e-servers: reusing marketing on 3002");
    await waitForUrl("http://127.0.0.1:3002/health", 30_000);
  }

  // Warm portal public-auth BFF before SMK-MKT-03 send-code (first compile can exceed 60s).
  await waitForUrl("http://127.0.0.1:3003/health", 30_000);
  await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3003,
        path: "/api/public-auth/request-otp",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "operator.localhost:3003",
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        reject(new Error(`warm request-otp failed: ${res.statusCode}`));
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify({ phone: "+15550009901" }));
    req.end();
  }).catch((error) => {
    console.warn("smoke-marketing-e2e-servers: request-otp warm skipped:", error.message);
  });

  console.log("smoke-marketing-e2e-servers: API + portal + marketing ready");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
