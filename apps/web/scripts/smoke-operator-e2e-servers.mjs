#!/usr/bin/env node
/**
 * Starts API + Web for Phase 9 operator smoke Playwright (memory storage).
 * Skips spawn for ports already listening (Playwright reuse / manual dev).
 * @see docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveOperatorSmokeOwnerMobile } from "./operator-smoke-identity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const joseEntry = path.join(repoRoot, "apps/api/node_modules/jose/dist/webapi/index.js");
const operatorTenantId =
  process.env.TOUR_OPS_DEV_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";
const operatorSmokeOwnerUserId = "00000000-0000-4000-8000-000000000101";
const operatorSmokeOwnerMobile = resolveOperatorSmokeOwnerMobile();
const operatorSmokeSeedTourTitle = "North Ridge Trek";

/** Cursor shell may expose Node 22 on PATH ahead of nvm — pin repo .nvmrc for spawned pnpm/next. */
function resolveRepoNodeBinDir() {
  try {
    const version = fs.readFileSync(path.join(repoRoot, ".nvmrc"), "utf8").trim();
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const candidate = path.join(home, ".nvm/versions/node", `v${version}`, "bin");
    if (fs.existsSync(path.join(candidate, "node"))) {
      return candidate;
    }
  } catch {
    // fall through
  }
  return null;
}

function withRepoNodePath(env) {
  const binDir = resolveRepoNodeBinDir();
  if (binDir === null) {
    return env;
  }
  return { ...env, PATH: `${binDir}:${env.PATH ?? process.env.PATH ?? ""}` };
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
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-operator-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 2_000);
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
      req.setTimeout(60_000, () => {
        req.destroy();
        inFlight = false;
        retry();
      });
    };
    tick();
  });
}

async function bootstrapSmokeJwtEnv() {
  const { exportPKCS8, exportSPKI, generateKeyPair } = await import(joseEntry);
  const pair = await generateKeyPair("RS256", { extractable: true });
  return {
    AUTH_JWT_PUBLIC_KEY: await exportSPKI(pair.publicKey),
    AUTH_JWT_PRIVATE_KEY: await exportPKCS8(pair.privateKey),
    AUTH_JWT_ISSUER: "tour-ops",
    AUTH_JWT_AUDIENCE: "tour-ops-api",
  };
}

async function resolveSmokeJwtEnv() {
  const publicKey = process.env.AUTH_JWT_PUBLIC_KEY?.trim();
  const privateKey = process.env.AUTH_JWT_PRIVATE_KEY?.trim();
  if (publicKey !== undefined && publicKey.length > 0 && privateKey !== undefined && privateKey.length > 0) {
    return {
      AUTH_JWT_PUBLIC_KEY: publicKey,
      AUTH_JWT_PRIVATE_KEY: privateKey,
      AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER?.trim() || "tour-ops",
      AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE?.trim() || "tour-ops-api",
    };
  }
  return bootstrapSmokeJwtEnv();
}

let api;
let web;

const shutdown = (signal) => {
  if (api) {
    api.kill(signal);
  }
  if (web) {
    web.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function keepAlive() {
  return new Promise(() => {});
}

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    // port already free or fuser unavailable
  }
}

/** SMK-P9-07 — refuse reuse when API lacks OPERATOR_SMOKE_E2E_SEED tour fixture. */
async function probeOperatorSmokeSeedReady() {
  const headers = {
    "x-tenant-id": operatorTenantId,
    "x-authenticated-tenant-id": operatorTenantId,
    "x-user-id": operatorSmokeOwnerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-smoke",
  };
  return new Promise((resolve) => {
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
}

function probeTenantContextHost(forwardedHost) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: "/public/tenant-context",
        method: "GET",
        headers: {
          host: forwardedHost,
          "x-forwarded-host": forwardedHost,
        },
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
            resolve(body?.data?.tenantId === operatorTenantId);
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
}

async function waitForTenantContextReady(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeTenantContextHost("operator.admin.localhost")) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

/**
 * SMK-P6-HOST-01 is additive — do not kill the memory operator stack when
 * tenant-context is unavailable (BFF/wizard OTP still works). Soft-warn only.
 */
async function runP6HostBindSmoke() {
  const ready = await waitForTenantContextReady(30_000);
  if (!ready) {
    console.warn(
      "smoke-operator-e2e-servers: skipping P6 host-bind — tenant-context not ready on operator.admin.localhost (memory smoke continues)"
    );
    return;
  }
  const scriptPath = path.join(repoRoot, "scripts/smoke-p6-host-bind.mjs");
  const deadline = Date.now() + 30_000;
  let lastStatus = 1;
  while (Date.now() < deadline) {
    const result = spawnSync("node", [scriptPath], {
      cwd: repoRoot,
      env: { ...process.env, TOUR_OPS_API_URL: "http://127.0.0.1:3001" },
      stdio: "pipe",
      encoding: "utf8",
    });
    lastStatus = result.status ?? 1;
    if (lastStatus === 0) {
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      return;
    }
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  console.warn(
    `smoke-operator-e2e-servers: P6 host-bind soft-fail (exit ${lastStatus}) — operator memory smoke continues`
  );
}

try {
  let apiListening = await isPortListening(3001);
  const webListening = await isPortListening(3000);

  if (apiListening && webListening) {
    const seedReady = await probeOperatorSmokeSeedReady();
    if (seedReady) {
      console.log("smoke-operator-e2e-servers: reusing existing API (3001) + web (3000)");
      await waitForUrl("http://127.0.0.1:3001/health", 30_000);
      await keepAlive();
    }
    console.warn(
      "smoke-operator-e2e-servers: ports 3000/3001 busy but operator smoke seed missing — restarting API on 3001 with OPERATOR_SMOKE_E2E_SEED=1"
    );
    freePort(3001);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    apiListening = false;
  }

  const jwtEnv = await bootstrapSmokeJwtEnv();

  const apiEnv = withRepoNodePath({
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "test",
    STORAGE_DRIVER: "memory",
    AUTH_ALLOW_DEV_STATIC_OTP: "true",
    OPERATOR_SMOKE_E2E_SEED: "1",
    OPERATOR_OWNER_MOBILE: operatorSmokeOwnerMobile,
    OPERATOR_OWNER_USER_ID: operatorSmokeOwnerUserId,
    P5_VALIDATION_WORKERS_ENABLED: "false",
    PORT: "3001",
    TENANT_RATE_LIMIT_ENABLED: "false",
    PROJECTION_AUTO_RECONCILE_ENABLED: "false",
    PRIORITY_LOAD_SHED_ENABLED: "false",
  });
  // Strip shell Postgres/Redis so memory smoke cannot bind …0014 to a durable DB.
  delete apiEnv.DATABASE_URL;
  delete apiEnv.DATABASE_URL_ADMIN;
  delete apiEnv.REDIS_URL;
  delete apiEnv.OPERATOR_SMOKE_WORKSPACE_TYPE;

  const webEnv = withRepoNodePath({
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "development",
    ALLOW_DEV_WEB_SESSION: "true",
    ALLOW_DENALI_WEB_PLUGIN: "true",
    TOUR_OPS_DEV_TENANT_ID: operatorTenantId,
    TOUR_OPS_API_URL: "http://127.0.0.1:3001",
    API_INTERNAL_URL: "http://127.0.0.1:3001",
    PORT: "3000",
  });

  if (!apiListening) {
    api = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: path.join(repoRoot, "apps/api"),
      env: apiEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3001/health");
  } else {
    console.log("smoke-operator-e2e-servers: API already on 3001 — skipping spawn");
  }

  if (!webListening) {
    web = spawn(
      "pnpm",
      ["exec", "next", "dev", "--port", "3000", "--hostname", "127.0.0.1"],
      {
        cwd: webDir,
        env: webEnv,
        stdio: "inherit",
      }
    );
    await waitForUrl("http://127.0.0.1:3000/", 300_000);
    await waitForUrl("http://127.0.0.1:3000/auth/login", 300_000);
    await waitForUrl("http://127.0.0.1:3000/bookings/new", 300_000);
    console.log("smoke-operator-e2e-servers: web routes warm (login + bookings/new)");
  } else {
    console.log("smoke-operator-e2e-servers: web already on 3000 — skipping spawn");
  }

  console.log("smoke-operator-e2e-servers: API + web ready");
  await runP6HostBindSmoke();
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
