#!/usr/bin/env node
/**
 * Starts API + Web for P1 Platform Control Center Playwright E2E.
 * Requires Postgres (`DATABASE_URL` + `DATABASE_URL_ADMIN`) for provision saga.
 *
 * @see docs/phase-15/platform-control-center-ui.mdoc
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const apiDir = path.join(repoRoot, "apps/api");
const joseEntry = path.join(repoRoot, "apps/api/node_modules/jose/dist/webapi/index.js");
const platformOpsPhone = process.env.PLATFORM_OPS_PHONE?.trim() || "+989121234567";

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional env files
  }
}

loadEnvFile(path.join(apiDir, ".env"));
loadEnvFile(path.join(apiDir, ".env.local"));
loadEnvFile(path.join(webDir, ".env.local"));

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

function waitForUrl(url, timeoutMs = 360_000) {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-platform-e2e-servers: timeout waiting for ${url}`));
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
  if (publicKey && privateKey) {
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
  if (api) api.kill(signal);
  if (web) web.kill(signal);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function keepAlive() {
  return new Promise(() => {});
}

if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
  console.error(
    "smoke-platform-e2e-servers: DATABASE_URL and DATABASE_URL_ADMIN are required for platform provision E2E"
  );
  process.exit(1);
}

function runMigrateDeploy() {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@apps/api", "run", "db:migrate:deploy"],
    {
      cwd: repoRoot,
      env: withRepoNodePath({ ...process.env }),
      stdio: "inherit",
    }
  );
  if ((result.status ?? 1) !== 0) {
    throw new Error("smoke-platform-e2e-servers: db:migrate:deploy failed");
  }
}

function runDbSeed() {
  const result = spawnSync("pnpm", ["--filter", "@apps/api", "run", "db:seed"], {
    cwd: repoRoot,
    env: withRepoNodePath({ ...process.env, NODE_ENV: "development" }),
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error("smoke-platform-e2e-servers: db:seed failed");
  }
}

try {
  runMigrateDeploy();
  runDbSeed();
  const jwtEnv = await resolveSmokeJwtEnv();
  const apiListening = await isPortListening(3001);
  const webListening = await isPortListening(3000);

  const apiEnv = withRepoNodePath({
    ...process.env,
    ...jwtEnv,
    NODE_ENV: "test",
    STORAGE_DRIVER: process.env.STORAGE_DRIVER?.trim() || "memory",
    AUTH_ALLOW_DEV_STATIC_OTP: "true",
    PLATFORM_OPS_PHONES: platformOpsPhone,
    PLATFORM_ROOT_DOMAIN: process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost",
    P5_VALIDATION_WORKERS_ENABLED: "false",
    PORT: "3001",
    TENANT_RATE_LIMIT_ENABLED: "false",
  });

  const webEnv = withRepoNodePath({
    ...process.env,
    NODE_ENV: "development",
    ALLOW_DEV_WEB_SESSION: "true",
    ALLOW_DENALI_WEB_PLUGIN: "true",
    PLATFORM_OPS_PHONES: platformOpsPhone,
    PLATFORM_ROOT_DOMAIN: process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost",
    TOUR_OPS_API_URL: "http://127.0.0.1:3001",
    API_INTERNAL_URL: "http://127.0.0.1:3001",
    PORT: "3000",
  });

  if (!apiListening) {
    api = spawn("pnpm", ["--filter", "@apps/api", "run", "dev"], {
      cwd: repoRoot,
      env: apiEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3001/health");
  } else {
    console.log("smoke-platform-e2e-servers: API already on 3001 — reusing");
  }

  if (!webListening) {
    web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000", "--hostname", "127.0.0.1"], {
      cwd: webDir,
      env: webEnv,
      stdio: "inherit",
    });
    await waitForUrl("http://127.0.0.1:3000/", 360_000);
  } else {
    console.log("smoke-platform-e2e-servers: web already on 3000 — reusing");
  }

  await waitForUrl("http://admin.localhost:3000/auth/login", 360_000);
  await waitForUrl("http://admin.localhost:3000/platform/clubs/new", 360_000);
  console.log("smoke-platform-e2e-servers: API + web ready (platform host)");
  await keepAlive();
} catch (error) {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
}
