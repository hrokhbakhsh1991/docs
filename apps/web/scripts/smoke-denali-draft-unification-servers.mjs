#!/usr/bin/env node
/**
 * Memory-mode API + Web for denali draft unification smoke (no Postgres).
 * Matches denali.localhost host map + ws-denali-dev workspace seed.
 */
import { execSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");

const denaliSmokeTenantId =
  process.env.DENALI_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000003";
const ownerMobile = process.env.OPERATOR_OWNER_MOBILE?.trim() || "+989121000001";

function waitForUrl(url, timeoutMs = 240_000) {
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
        reject(new Error(`smoke-denali-draft-unification-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function isUrlHealthy(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // port already free or fuser unavailable
  }
}

async function waitUntilPortsFree(ports, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy = await Promise.all(
      ports.map((port) => isUrlHealthy(`http://127.0.0.1:${port}/health`))
    );
    if (!busy.some(Boolean)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `smoke-denali-draft-unification-servers: ports ${ports.join(", ")} still busy after ${timeoutMs}ms`
  );
}

const apiEnv = {
  ...process.env,
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  PORT: "3001",
  TENANT_RATE_LIMIT_ENABLED: "false",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  OPERATOR_OWNER_MOBILE: ownerMobile,
};

const unificationOn = process.env.SMOKE_EXPECT_UNIFICATION_ON === "true";
const forceFreshServers = process.env.SMOKE_FORCE_FRESH_SERVERS === "1" || unificationOn;

const webEnv = {
  ...process.env,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  TOUR_OPS_DEV_TENANT_ID: denaliSmokeTenantId,
  TOUR_OPS_DEV_WORKSPACE_ID: "ws-denali-dev",
  PORT: "3000",
  NEXT_PUBLIC_DRAFT_UNIFICATION_V3: unificationOn
    ? "on"
    : (process.env.NEXT_PUBLIC_DRAFT_UNIFICATION_V3 ?? "off"),
};

const children = [];

async function start() {
  let apiHealthy = await isUrlHealthy("http://127.0.0.1:3001/health");
  let webHealthy = await isUrlHealthy("http://127.0.0.1:3000/health");

  if (!forceFreshServers && apiHealthy && webHealthy) {
    console.log("smoke-denali-draft-unification-servers: reusing existing API :3001 + web :3000");
    return;
  }

  if (forceFreshServers && (apiHealthy || webHealthy)) {
    console.log(
      "smoke-denali-draft-unification-servers: freeing ports 3000–3001 for fresh unification stack"
    );
    freePort(3000);
    freePort(3001);
    await waitUntilPortsFree([3000, 3001]);
    apiHealthy = false;
    webHealthy = false;
  }

  if (!apiHealthy) {
    const api = spawn("pnpm", ["--filter", "@apps/api", "run", "dev"], {
      cwd: repoRoot,
      env: apiEnv,
      stdio: "inherit",
    });
    children.push(api);
    await waitForUrl("http://127.0.0.1:3001/health");
  }

  if (!webHealthy) {
    const web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000"], {
      cwd: webDir,
      env: webEnv,
      stdio: "inherit",
    });
    children.push(web);
    await waitForUrl("http://127.0.0.1:3000/health");
  }
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
