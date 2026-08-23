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
const readinessPort = Number(process.env.MARKETING_SMOKE_READY_PORT?.trim() || "3012");
const mandatoryWarmTimeoutMs = 600_000;
const portalRegistrationPrimeTimeoutMs = 240_000;
const browserWarmHeaders = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "app-tour-marketing-smoke-warmup/1.0",
};
const smokePublishedTourId =
  process.env.SMOKE_PUBLISHED_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000220";
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
    let settled = false;
    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadlineTimer);
      fn(value);
    };
    const deadlineTimer = setTimeout(() => {
      finish(reject, new Error(`smoke-marketing-e2e-servers: timeout waiting for ${url}`));
    }, timeoutMs);
    const tick = () => {
      if (settled) {
        return;
      }
      let attemptSettled = false;
      const retryOnce = () => {
        if (attemptSettled) {
          return;
        }
        attemptSettled = true;
        retry();
      };
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          attemptSettled = true;
          finish(resolve);
          return;
        }
        retryOnce();
      });
      req.on("error", retryOnce);
      req.setTimeout(2_000, () => {
        req.destroy();
        retryOnce();
      });
    };
    const retry = () => {
      if (settled) {
        return;
      }
      if (Date.now() >= deadline) {
        finish(reject, new Error(`smoke-marketing-e2e-servers: timeout waiting for ${url}`));
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

let readinessReady = false;
const readinessServer = http.createServer((_req, res) => {
  if (!readinessReady) {
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("warming\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ready\n");
});
readinessServer.listen(readinessPort, "127.0.0.1");

function warmPortalPath(path, method = "GET", body = null, options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      fn(value);
    };
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3003,
        path,
        method,
        headers: {
          ...browserWarmHeaders,
          "Content-Type": "application/json",
          host: portalWarmHost,
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          finish(resolve);
          return;
        }
        finish(reject, new Error(`warm ${method} ${path} failed: ${res.statusCode}`));
      }
    );
    req.on("error", (error) => finish(reject, error));
    req.setTimeout(options.timeoutMs ?? mandatoryWarmTimeoutMs, () => {
      req.destroy();
      if (options.resolveOnTimeout === true) {
        finish(resolve);
        return;
      }
      finish(reject, new Error(`warm ${method} ${path} timed out`));
    });
    if (body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function warmMarketingPath(path) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      fn(value);
    };
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: Number(marketingSmokeOrigin.port || "3002"),
        path,
        method: "GET",
        headers: {
          ...browserWarmHeaders,
          host: marketingSmokeOrigin.host,
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          finish(resolve);
          return;
        }
        finish(reject, new Error(`warm GET ${path} failed: ${res.statusCode}`));
      }
    );
    req.on("error", (error) => finish(reject, error));
    req.setTimeout(mandatoryWarmTimeoutMs, () => {
      req.destroy();
      finish(reject, new Error(`warm GET ${path} timed out`));
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
  // Must match API ephemeral RS256 pair — otherwise middleware
  // validateSessionTokenAsync → invalid_signature → clears atour_mb_session
  // and P3-E2E-D01 /me after register-complete fails (DG-4.7.2).
  ...jwtEnv,
  NODE_ENV: "development",
  NEXT_FONT_OFFLINE: "1",
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
  NEXT_FONT_OFFLINE: "1",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  PORTAL_DEV_PORT: "3003",
};

let api;
let marketing;
let portal;

const shutdown = (signal) => {
  readinessServer.close();
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
  await warmPortalPath("/api/public-auth/verify-otp", "POST", {
    phone: "+15550009901",
    otp: "1234",
    challenge_id: "warm",
  }).catch((error) => {
    console.warn("smoke-marketing-e2e-servers: verify-otp warm skipped:", error.message);
  });
  await warmPortalPath("/api/catalog/registrations", "GET").catch((error) => {
    console.warn("smoke-marketing-e2e-servers: catalog registrations warm skipped:", error.message);
  });
  // App Router page warmup must complete before readiness; the Playwright
  // browser journey below remains the semantic assertion for registration behavior.
  await warmPortalPath(`/catalog/${smokePublishedTourId}/register`, "GET", null, {
    timeoutMs: portalRegistrationPrimeTimeoutMs,
  });
  await warmMarketingPath("/tours");
  await warmMarketingPath(`/tours/${smokePublishedTourId}`);

  readinessReady = true;
  console.log("smoke-marketing-e2e-servers: API + portal + marketing ready");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
