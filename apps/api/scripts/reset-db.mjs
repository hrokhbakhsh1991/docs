#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const resolved = resolveMigrateUrl();
if (!resolved) {
  console.error("db:reset: FAIL — set DATABASE_URL_ADMIN (preferred) or DATABASE_URL");
  process.exit(1);
}

const prismaBin = path.join(API_ROOT, "node_modules", ".bin", "prisma");
const prismaCmd = fs.existsSync(prismaBin) ? prismaBin : "prisma";

console.log(`db:reset: Running migrate reset --force using ${resolved.source}`);

const result = spawnSync(
  prismaCmd,
  ["migrate", "reset", "--force", "--schema=./prisma/schema.prisma"],
  {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: resolved.url },
    stdio: "inherit",
  }
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

async function grantPermissions() {
  const prismaAdmin = new PrismaClient({
    datasources: { db: { url: resolved.url } },
  });

  try {
    console.log("db:reset: Granting permissions to app_tour...");
    await prismaAdmin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO app_tour;`);
    await prismaAdmin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tour;`);
    await prismaAdmin.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tour;`);
    await prismaAdmin.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tour;`);
    await prismaAdmin.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tour;`);
    console.log("db:reset: Permissions granted successfully.");
  } catch (err) {
    console.error("db:reset: Failed to grant permissions:", err);
    process.exit(1);
  } finally {
    await prismaAdmin.$disconnect();
  }
}

grantPermissions().then(() => {
  process.exit(0);
});
