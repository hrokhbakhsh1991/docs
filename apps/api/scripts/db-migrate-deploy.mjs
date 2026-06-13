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

/** Local dev only — CI/VPS inject DATABASE_URL_ADMIN via env (never rely on gitignored .env). */
function loadOptionalEnvFile(filename) {
  const filePath = path.join(API_ROOT, filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadOptionalEnvFile(".env");
loadOptionalEnvFile(".env.local");

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
