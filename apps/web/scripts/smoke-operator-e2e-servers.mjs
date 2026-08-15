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
const operatorSmokeDbUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev";
const operatorSmokeDbAdminUrl =
  process.env.DATABASE_URL_ADMIN?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:5434/app_tour_dev";
/**
 * Finance workspace scenarios create manual payments / receipts, so the operator smoke stack
 * needs Prisma + DATABASE_URL by default. Set OPERATOR_SMOKE_USE_DATABASE=0 to force legacy memory smoke.
 */
const useFinanceDatabase = process.env.OPERATOR_SMOKE_USE_DATABASE !== "0";

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

function createChildExitError(label, code, signal) {
  const suffix =
    typeof code === "number"
      ? `exit ${code}`
      : signal
        ? `signal ${signal}`
        : "unknown exit";
  return new Error(`smoke-operator-e2e-servers: ${label} exited before readiness (${suffix})`);
}

function waitForUrlOrChildExit(child, url, label, timeoutMs = 300_000) {
  if (child.exitCode !== null) {
    return Promise.reject(createChildExitError(label, child.exitCode, child.signalCode));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      child.off("exit", onExit);
      child.off("error", onError);
    };

    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };

    const settleReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onExit = (code, signal) => {
      settleReject(createChildExitError(label, code, signal));
    };

    const onError = (error) => {
      settleReject(error);
    };

    child.once("exit", onExit);
    child.once("error", onError);

    waitForUrl(url, timeoutMs).then(settleResolve).catch(settleReject);
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
  if (
    publicKey !== undefined &&
    publicKey.length > 0 &&
    privateKey !== undefined &&
    privateKey.length > 0
  ) {
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

async function probeOperatorSmokeApiCompatible() {
  const seedReady = await probeOperatorSmokeSeedReady();
  if (!seedReady) {
    return false;
  }
  const body = JSON.stringify({ mobile: operatorSmokeOwnerMobile });
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: "/auth/phone-preflight",
        method: "POST",
        headers: {
          "x-tenant-id": operatorTenantId,
          "x-authenticated-tenant-id": operatorTenantId,
          "x-user-id": "00000000-0000-4000-8000-000000000099",
          "x-actor-role": "member",
          "x-membership-status": "ACTIVE",
          "x-workspace-id": "ws-operator-smoke",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
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
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            resolve(payload?.authorized === true);
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
    req.write(body);
    req.end();
  });
}

async function probeOperatorSmokeFinanceReady() {
  if (!useFinanceDatabase) {
    return true;
  }
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
        path: "/finance/reports/summary",
        method: "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            resolve(res.statusCode === 200 && payload?.error !== "database_unavailable");
          } catch {
            resolve(res.statusCode === 200);
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

async function waitForOperatorSmokeFinanceReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeOperatorSmokeFinanceReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

async function probeOperatorSmokeLoginReady() {
  const body = JSON.stringify({ phone: operatorSmokeOwnerMobile });
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: "/api/auth/phone-preflight",
        method: "POST",
        headers: {
          host: "operator.admin.localhost:3000",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
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
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            resolve(payload?.ok === true && payload?.authorized === true);
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
    req.write(body);
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

function runDbBackedOperatorSmokeSeed() {
  if (!useFinanceDatabase) {
    return;
  }
  const scripts = [
    "scripts/seed-denali-smoke-for-playwright.ts",
    "scripts/seed-operator-smoke-identity-staging.ts",
  ];
  for (const script of scripts) {
    const result = spawnSync(
      "node",
      ["--import", "tsx", "--env-file=.env", "--env-file=.env.local", script],
      {
        cwd: path.join(repoRoot, "apps/api"),
        env: withRepoNodePath({
          ...process.env,
          NODE_ENV: "development",
          OPERATOR_OWNER_MOBILE: operatorSmokeOwnerMobile,
          OPERATOR_OWNER_USER_ID: operatorSmokeOwnerUserId,
        }),
        stdio: "pipe",
        encoding: "utf8",
      }
    );
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.status === 0) {
      continue;
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(
      `smoke-operator-e2e-servers: db-backed operator smoke seed failed for ${script} (exit ${
        result.status ?? 1
      })`
    );
  }
}

try {
  let apiListening = await isPortListening(3001);
  let webListening = await isPortListening(3000);

  if (apiListening) {
    const apiCompatible = await probeOperatorSmokeApiCompatible();
    const financeReady = await probeOperatorSmokeFinanceReady();
    if (!apiCompatible || !financeReady) {
      console.warn(
        `smoke-operator-e2e-servers: API on 3001 is not operator-smoke compatible${
          !financeReady ? " or finance DB is unavailable" : ""
        } — restarting with OPERATOR_SMOKE_E2E_SEED=1`
      );
      freePort(3001);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      apiListening = false;
    }
  }

  if (apiListening && webListening) {
    const loginReady = await probeOperatorSmokeLoginReady();
    if (loginReady) {
      console.log("smoke-operator-e2e-servers: reusing existing API (3001) + web (3000)");
      await waitForUrl("http://127.0.0.1:3001/health", 30_000);
      await keepAlive();
    }
    if (!loginReady) {
      console.warn(
        "smoke-operator-e2e-servers: ports 3000/3001 busy but operator smoke auth preflight failed — restarting web on 3000 with ALLOW_DEV_WEB_SESSION=true"
      );
      freePort(3000);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      webListening = false;
    }
  }

  const jwtEnv = await bootstrapSmokeJwtEnv();

  const apiEnv = withRepoNodePath({
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "test",
    ...(useFinanceDatabase
      ? {
          DATABASE_URL: operatorSmokeDbUrl,
          DATABASE_URL_ADMIN: operatorSmokeDbAdminUrl,
        }
      : {}),
    STORAGE_DRIVER: useFinanceDatabase
      ? process.env.STORAGE_DRIVER?.trim() || "prisma"
      : "memory",
    AUTH_ALLOW_DEV_STATIC_OTP: "true",
    OPERATOR_SMOKE_E2E_SEED: "1",
    OPERATOR_OWNER_MOBILE: operatorSmokeOwnerMobile,
    OPERATOR_OWNER_USER_ID: operatorSmokeOwnerUserId,
    P5_VALIDATION_WORKERS_ENABLED: "false",
    PORT: "3001",
    HOST: "127.0.0.1",
    TENANT_RATE_LIMIT_ENABLED: "false",
    PROJECTION_AUTO_RECONCILE_ENABLED: "false",
    PRIORITY_LOAD_SHED_ENABLED: "false",
  });
  if (!useFinanceDatabase) {
    // Strip shell Postgres/Redis so legacy memory smoke cannot bind …0014 to a durable DB.
    delete apiEnv.DATABASE_URL;
    delete apiEnv.DATABASE_URL_ADMIN;
    delete apiEnv.REDIS_URL;
  }
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
    api = spawn(
      "node",
      ["--import", "tsx", "--env-file=.env", "--env-file=.env.local", "src/main.ts"],
      {
      cwd: path.join(repoRoot, "apps/api"),
      env: apiEnv,
      stdio: "inherit",
      }
    );
    await waitForUrlOrChildExit(api, "http://127.0.0.1:3001/health", "API server");
    runDbBackedOperatorSmokeSeed();
    if (!(await waitForOperatorSmokeFinanceReady())) {
      throw new Error(
        "smoke-operator-e2e-servers: finance database is not ready for operator smoke"
      );
    }
  } else {
    console.log("smoke-operator-e2e-servers: API already on 3001 — skipping spawn");
  }

  if (!webListening) {
    web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000", "--hostname", "127.0.0.1"], {
      cwd: webDir,
      env: webEnv,
      stdio: "inherit",
    });
    await waitForUrlOrChildExit(web, "http://127.0.0.1:3000/", "web server", 300_000);
    await waitForUrlOrChildExit(web, "http://127.0.0.1:3000/auth/login", "web server", 300_000);
    await waitForUrlOrChildExit(web, "http://127.0.0.1:3000/bookings/new", "web server", 300_000);
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
