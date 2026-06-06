#!/usr/bin/env node
/**
 * DEC-124 — Prisma migrate deploy with owner URL when available.
 * @see docs/phase-5/appendices/migrate-deploy-only.md
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveMigrateUrl() {
  const admin = process.env.DATABASE_URL_ADMIN?.trim();
  if (admin) return { url: admin, source: "DATABASE_URL_ADMIN" };
  const app = process.env.DATABASE_URL?.trim();
  if (app) return { url: app, source: "DATABASE_URL" };
  return null;
}

const resolved = resolveMigrateUrl();
if (!resolved) {
  console.error("db:migrate:deploy: FAIL — set DATABASE_URL_ADMIN (preferred) or DATABASE_URL");
  process.exit(1);
}

if (resolved.source === "DATABASE_URL") {
  console.warn(
    "db:migrate:deploy: WARN — DATABASE_URL_ADMIN unset; using DATABASE_URL (owner role required for RLS DDL)"
  );
}

const result = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "deploy", "--schema=./prisma/schema.prisma"],
  {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: resolved.url },
    stdio: "inherit",
    shell: true,
  }
);

process.exit(result.status ?? 1);
