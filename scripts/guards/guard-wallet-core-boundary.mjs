#!/usr/bin/env node
/**
 * Monorepo entrypoint — delegates to package-local wallet-core guard.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PKG_GUARD = path.join(
  REPO_ROOT,
  "packages/wallet-core/scripts/guard-boundary.mjs",
);

const r = spawnSync(process.execPath, [PKG_GUARD], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  stdio: "inherit",
});

process.exit(r.status === null ? 1 : r.status);
