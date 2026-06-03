#!/usr/bin/env node
/**
 * Phase 2.5 gate entrypoint — delegates to scripts/guards/phase-2-guard.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guardScript = path.join(__dirname, "guards", "phase-2-guard.mjs");

const result = spawnSync(process.execPath, [guardScript], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
});

process.exit(result.status ?? 1);
