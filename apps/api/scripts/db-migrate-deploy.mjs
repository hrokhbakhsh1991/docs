#!/usr/bin/env node
/**
 * DEC-124 — Prisma migrate deploy with owner URL when available.
 * @see docs/phase-5/appendices/migrate-deploy-only.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}@${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
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

console.log(
  `db:migrate:deploy: using ${resolved.source} (${redactDatabaseUrl(resolved.url)})`
);

const prismaBin = path.join(API_ROOT, "node_modules", ".bin", "prisma");
const prismaCmd = fs.existsSync(prismaBin) ? prismaBin : "prisma";

const result = spawnSync(
  prismaCmd,
  ["migrate", "deploy", "--schema=./prisma/schema.prisma"],
  {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: resolved.url },
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
