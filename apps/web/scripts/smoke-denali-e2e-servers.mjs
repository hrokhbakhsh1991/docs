#!/usr/bin/env node
/**
 * Starts API + Web for Phase 6.6 denali smoke Playwright.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webDir = path.join(repoRoot, "apps/web");

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32";
const dbAdmin =
  process.env.DATABASE_URL_ADMIN?.trim() || "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

function waitForUrl(url, timeoutMs = 180_000) {
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
        reject(new Error(`smoke-denali-e2e-servers: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const seed = spawn("node", ["scripts/seed-denali-smoke-tenant.mjs"], {
  cwd: webDir,
  env: { ...process.env, DATABASE_URL: dbUrl, DATABASE_URL_ADMIN: dbAdmin },
  stdio: "inherit",
});

seed.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const apiEnv = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: dbUrl,
    STORAGE_DRIVER: "prisma",
    PORT: "3001",
    TENANT_RATE_LIMIT_ENABLED: "false",
  };

  const webEnv = {
    ...process.env,
    NODE_ENV: "development",
    ALLOW_DEV_WEB_SESSION: "true",
    TOUR_OPS_API_URL: "http://127.0.0.1:3001",
    API_INTERNAL_URL: "http://127.0.0.1:3001",
    PORT: "3000",
  };

  const api = spawn("pnpm", ["--filter", "@apps/api", "run", "dev"], {
    cwd: repoRoot,
    env: apiEnv,
    stdio: "inherit",
  });

  const web = spawn("pnpm", ["--filter", "@apps/web", "run", "dev"], {
    cwd: repoRoot,
    env: webEnv,
    stdio: "inherit",
  });

  void waitForUrl("http://127.0.0.1:3001/health").then(() => waitForUrl("http://127.0.0.1:3000/"));

  const shutdown = (signal) => {
    api.kill(signal);
    web.kill(signal);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
});
