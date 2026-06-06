#!/usr/bin/env node
/**
 * Seeds MAP 4.3 tenants in Postgres before TH-1 Playwright e2e.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const dbUrl =
  process.env.DATABASE_URL_ADMIN?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "";

if (!dbUrl) {
  console.error("seed-th1-tenants: DATABASE_URL or DATABASE_URL_ADMIN required");
  process.exit(1);
}

const seed = spawnSync(
  "pnpm",
  ["--filter", "@apps/api", "run", "db:seed"],
  {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: dbUrl, NODE_ENV: "development" },
    stdio: "inherit",
  },
);

process.exit(seed.status ?? 1);
