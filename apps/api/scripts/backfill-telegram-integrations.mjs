#!/usr/bin/env node
/**
 * Step 6 — backfill workspace_telegram_bots → integration_connections (telegram).
 *
 * Usage:
 *   pnpm --filter @apps/api run integrations:backfill-telegram -- --dry-run
 *   pnpm --filter @apps/api run integrations:backfill-telegram -- --dry-run --tenant=<uuid>
 *   pnpm --filter @apps/api run integrations:backfill-telegram -- --apply --tenant=<uuid>
 *   pnpm --filter @apps/api run integrations:verify-telegram-backfill
 *   pnpm --filter @apps/api run integrations:verify-telegram-backfill -- --tenant=<uuid>
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "./src/integrations/migration/run-telegram-backfill-cli.ts",
    ...process.argv.slice(2),
  ],
  {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
