#!/usr/bin/env node
/**
 * Starts API + Portal + Marketing for SMK-MKT-* Playwright smoke.
 * Registration CTA targets apps/portal (DEC-P11-014).
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";
import { cleanNextDevCache } from "./smoke-next-dev-cache.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const marketingDir = path.join(repoRoot, "apps/marketing");
const portalDir = path.join(repoRoot, "apps/portal");

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL?.trim() || "http://denali.localhost:3002";
const marketingSmokeOrigin = new URL(marketingSmokeBaseUrl);
const smokeUsesDenaliHost =
  marketingSmokeOrigin.hostname === "denali.localhost" ||
  marketingSmokeOrigin.hostname === "denali.club";
const operatorSmokeTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ||
  (smokeUsesDenaliHost ? DENALI_SMOKE_TENANT_ID : OPERATOR_SMOKE_TENANT_ID);
const portalWarmHost =
  process.env.SMOKE_PORTAL_HOST?.trim() ||
  (marketingSmokeOrigin.hostname === "denali.club"
    ? "portal.denali.club:3003"
    : smokeUsesDenaliHost
      ? "portal.denali.localhost:3003"
      : "portal.operator.localhost:3003");

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

function warmPortalPath(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3003,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          host: portalWarmHost,
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        reject(new Error(`warm ${method} ${path} failed: ${res.statusCode}`));
      }
    );
    req.on("error", reject);
    if (body !== null) {
      req.write(JSON.stringify(body));
    }
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
  // Must match API ephemeral RS256 pair — otherwise middleware
  // validateSessionTokenAsync → invalid_signature → clears atour_mb_session
  // and P3-E2E-D01 /me after register-complete fails (DG-4.7.2).
  ...jwtEnv,
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
  ...jwtEnv,
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
  // Ephemeral RS256 pair is minted this process. Reusing API/portal from a
  // prior run signs cookies with a different key → invalid_signature → guest OTP
  // loop on portal register (SMK-MKT-03).
  console.warn("smoke-marketing-e2e-servers: freeing 3001–3003 so JWT matches portal");
  freePort(3001);
  freePort(3002);
  freePort(3003);
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  api = spawn("node", ["--import", "tsx", "src/main.ts"], {
    cwd: path.join(repoRoot, "apps/api"),
    env: apiEnv,
    stdio: "inherit",
  });
  await waitForUrl("http://127.0.0.1:3001/health");

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

  // Warm portal BFF before SMK-MKT-03 (first compile can exceed 60s and Fast
  // Refresh-reloads the register document mid POST /api/catalog/registrations).
  await waitForUrl("http://127.0.0.1:3003/health", 30_000);
  await warmPortalPath("/api/public-auth/request-otp", "POST", { phone: "+15550009901" }).catch(
    (error) => {
      console.warn("smoke-marketing-e2e-servers: request-otp warm skipped:", error.message);
    }
  );
  await warmPortalPath("/api/catalog/registrations", "GET").catch((error) => {
    console.warn("smoke-marketing-e2e-servers: catalog registrations warm skipped:", error.message);
  });

  console.log("smoke-marketing-e2e-servers: API + portal + marketing ready");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
