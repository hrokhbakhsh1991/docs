#!/usr/bin/env node
/**
 * Starts API + Portal for portal registration smoke (SMK-PTL-01).
 * @see docs/phase-11/subphases/11.18-portal-e2e-smoke.md
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const portalDir = path.join(repoRoot, "apps/portal");
const webDir = path.join(repoRoot, "apps/web");

const operatorSmokeTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";

function waitForUrl(url, timeoutMs = 600_000, childProcess) {
  const deadline = Date.now() + timeoutMs;
  let settled = false;
  let onChildExit;

  const cleanup = () => {
    if (childProcess !== undefined && onChildExit !== undefined) {
      childProcess.off("exit", onChildExit);
    }
  };

  return new Promise((resolve, reject) => {
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    onChildExit = (code, signal) => {
      rejectOnce(
        new Error(
          `smoke-portal-e2e-servers: child exited before ready (${url}); ` +
            `code=${code ?? "null"} signal=${signal ?? "null"}`
        )
      );
    };
    childProcess?.once("exit", onChildExit);

    const tick = () => {
      if (settled) return;
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolveOnce();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(180_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (settled) return;
      if (Date.now() > deadline) {
        rejectOnce(new Error(`smoke-portal-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // The port is already free, or fuser is unavailable.
  }
}

async function waitForPortFree(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const listeners = execSync(`lsof -nP -tiTCP:${port} -sTCP:LISTEN`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (listeners.length === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch {
      return;
    }
  }
  throw new Error(`smoke-portal-e2e-servers: port ${port} still in use`);
}

const jwtEnv = await resolveSmokeApiJwtEnv();

const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  OPERATOR_SMOKE_E2E_SEED: "1",
  WRS_SMOKE_CUSTOM_APEX: "1",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  PAYMENT_HOLD_ENABLED: "true",
};
delete apiEnv.DATABASE_URL;
delete apiEnv.DATABASE_URL_ADMIN;

const portalSmokeHost =
  process.env.SMOKE_PORTAL_BASE_URL?.trim() || "http://portal.operator.localhost:3003";
const isCustomApexSmoke = portalSmokeHost.includes("denali.club");
const marketingPublicBaseUrl =
  process.env.MARKETING_PUBLIC_BASE_URL?.trim() ||
  (isCustomApexSmoke
    ? "http://denali.club:3002"
    : process.env.PORTAL_SMOKE_MODE === "production"
      ? "http://operator.localhost"
      : `${portalSmokeHost.replace(/\/$/, "")}/health`);

const portalEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: process.env.PORTAL_SMOKE_MODE === "production" ? "production" : "development",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORTAL_INTERNAL_URL: "http://127.0.0.1:3003",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-operator-smoke",
  PORTAL_DEV_PORT: "3003",
  MARKETING_PUBLIC_BASE_URL: marketingPublicBaseUrl,
  ...(process.env.PORTAL_SMOKE_MODE === "production"
    ? { MARKETING_PUBLIC_BASE_URL_ALLOWLIST: marketingPublicBaseUrl }
    : {}),
};

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  ALLOW_DEV_WEB_SESSION: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: operatorSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-operator-smoke",
  PORT: "3000",
};

const withAdmin = process.env.PORTAL_SMOKE_WITH_ADMIN === "1";
freePort(3001);
if (withAdmin) {
  freePort(3000);
}
freePort(3003);
if (withAdmin) {
  await waitForPortFree(3000);
}
await waitForPortFree(3001);
await waitForPortFree(3003);

const api = spawn("node", ["--import", "tsx", "src/main.ts"], {
  cwd: path.join(repoRoot, "apps/api"),
  env: apiEnv,
  stdio: "inherit",
});

let web;
let portal;

void waitForUrl("http://127.0.0.1:3001/health")
  .then(() => {
    if (withAdmin) {
      web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000", "--hostname", "127.0.0.1"], {
        cwd: webDir,
        env: webEnv,
        stdio: "inherit",
      });
      return waitForUrl("http://127.0.0.1:3000/bookings", 600_000, web);
    }
    return undefined;
  })
  .then(() => {
    if (
      process.env.PORTAL_SMOKE_MODE === "production" &&
      process.env.PORTAL_SMOKE_SKIP_BUILD !== "1"
    ) {
      execSync("pnpm run build", {
        cwd: portalDir,
        env: portalEnv,
        stdio: "inherit",
      });
    }
    portal = spawn(
      "pnpm",
      [
        "exec",
        "next",
        process.env.PORTAL_SMOKE_MODE === "production" ? "start" : "dev",
        "--port",
        "3003",
      ],
      {
        cwd: portalDir,
        env: portalEnv,
        stdio: "inherit",
      }
    );
    return waitForUrl("http://127.0.0.1:3003/health", 600_000, portal);
  })
  .then(async () => {
    console.log("smoke-portal-e2e-servers: API + portal ready");
    await new Promise(() => {});
  })
  .catch((error) => {
    console.error(error);
    api.kill("SIGTERM");
    if (web) web.kill("SIGTERM");
    if (portal) portal.kill("SIGTERM");
    process.exit(1);
  });

const shutdown = (signal) => {
  api.kill(signal);
  if (web) {
    web.kill(signal);
  }
  if (portal) {
    portal.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
