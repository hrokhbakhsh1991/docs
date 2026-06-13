#!/usr/bin/env node
/**
 * Seeds Phase 6.6 denali smoke tenant (workspace_type=denali).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dbUrl = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim() || "";

if (!dbUrl) {
  console.error("seed-denali-smoke-tenant: DATABASE_URL or DATABASE_URL_ADMIN required");
  process.exit(1);
}

const seed = spawnSync(
  "pnpm",
  ["--filter", "@apps/api", "exec", "node", "--import", "tsx", "scripts/seed-denali-smoke-for-playwright.ts"],
  {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: dbUrl, NODE_ENV: "development" },
    stdio: "inherit",
  }
);

process.exit(seed.status ?? 1);
