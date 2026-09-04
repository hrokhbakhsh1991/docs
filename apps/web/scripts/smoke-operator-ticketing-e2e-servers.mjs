#!/usr/bin/env node
/**
 * API + Web for operator ticketing E2E (Postgres / prisma driver).
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSmokeApiJwtEnv } from "../../api/scripts/smoke-api-jwt-env.mjs";
import { resolveOperatorSmokeOwnerMobile } from "./operator-smoke-identity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");
const apiDir = path.join(repoRoot, "apps/api");

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev?connection_limit=32";
const databaseUrlAdmin =
  process.env.DATABASE_URL_ADMIN?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:5434/app_tour_dev";
const operatorTenantId = "00000000-0000-4000-8000-000000000014";
const operatorSmokeOwnerUserId = "00000000-0000-4000-8000-000000000101";
const operatorSmokeOwnerMobile = resolveOperatorSmokeOwnerMobile();
const operatorSmokeCanonicalHost = "admin.operator.localhost:3000";

function waitForUrl(url, timeoutMs = 600_000) {
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
      req.setTimeout(180_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`smoke-operator-ticketing-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
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
          host: operatorSmokeCanonicalHost,
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
      },
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

async function waitForOperatorSmokeLoginReady(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeOperatorSmokeLoginReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  cwd: apiDir,
  env: { ...process.env, DATABASE_URL: databaseUrlAdmin, DATABASE_URL_ADMIN: databaseUrlAdmin },
  stdio: "inherit",
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const seed = spawnSync("pnpm", ["exec", "tsx", "scripts/seed-operator-ticketing-e2e-fixtures.ts"], {
  cwd: apiDir,
  env: {
    ...process.env,
    NODE_ENV: "test",
    STORAGE_DRIVER: "prisma",
    DATABASE_URL: databaseUrl,
    DATABASE_URL_ADMIN: databaseUrlAdmin,
    OPERATOR_OWNER_MOBILE: operatorSmokeOwnerMobile,
    OPERATOR_OWNER_USER_ID: operatorSmokeOwnerUserId,
  },
  stdio: "inherit",
});
if (seed.status !== 0) {
  process.exit(seed.status ?? 1);
}

const jwtEnv = await resolveSmokeApiJwtEnv();
const apiEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_URL_ADMIN: databaseUrlAdmin,
  STORAGE_DRIVER: "prisma",
  AUTH_ALLOW_DEV_STATIC_OTP: "true",
  OPERATOR_SMOKE_E2E_SEED: "1",
  OPERATOR_OWNER_MOBILE: operatorSmokeOwnerMobile,
  OPERATOR_OWNER_USER_ID: operatorSmokeOwnerUserId,
  PORT: "3001",
  HOST: "127.0.0.1",
  TENANT_RATE_LIMIT_ENABLED: "false",
};

const webEnv = {
  ...process.env,
  ...jwtEnv,
  NODE_ENV: "development",
  ALLOW_DEV_WEB_SESSION: "true",
  ALLOW_DENALI_WEB_PLUGIN: "true",
  TOUR_OPS_DEV_TENANT_ID: operatorTenantId,
  TOUR_OPS_API_URL: "http://127.0.0.1:3001",
  API_INTERNAL_URL: "http://127.0.0.1:3001",
  PORT: "3000",
};

const api = spawn(
  "node",
  ["--import", "tsx", "--env-file=.env", "--env-file=.env.local", "src/main.ts"],
  { cwd: apiDir, env: apiEnv, stdio: "inherit" },
);
await waitForUrl("http://127.0.0.1:3001/health");

const web = spawn("pnpm", ["exec", "next", "dev", "--port", "3000", "--hostname", "0.0.0.0"], {
  cwd: webDir,
  env: webEnv,
  stdio: "inherit",
});
await waitForUrl("http://admin.operator.localhost:3000/auth/login");
await waitForUrl("http://admin.operator.localhost:3000/tickets");

const loginReady = await waitForOperatorSmokeLoginReady();
if (!loginReady) {
  console.error(
    "smoke-operator-ticketing-e2e-servers: operator smoke login preflight failed for",
    operatorSmokeOwnerMobile,
  );
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  process.exit(1);
}

console.log("smoke-operator-ticketing-e2e-servers: API + web + login ready");

process.on("SIGINT", () => {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
});
process.on("SIGTERM", () => {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
});

await new Promise(() => {});
