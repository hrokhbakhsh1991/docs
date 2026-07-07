#!/usr/bin/env node
/**
 * INT-002c — remap exposure intents TourCreated → TourPublished (denali / telegram).
 *
 * Usage:
 *   pnpm --filter @apps/api run integrations:remap-tour-published-exposure -- --dry-run
 *   pnpm --filter @apps/api run integrations:remap-tour-published-exposure -- --apply
 *   pnpm --filter @apps/api run integrations:verify-tour-published-exposure
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
    "./src/integrations/migration/run-tour-published-exposure-remap-cli.ts",
    ...process.argv.slice(2),
  ],
  {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
