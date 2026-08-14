#!/usr/bin/env node
/**
 * Run full-repo dependency-cruiser from @app-tour/guards local node_modules.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { guardDepcruiseMain, REPO_ROOT } from "./guard-require.mjs";

const config = path.join(REPO_ROOT, "dependency-cruiser.config.js");
const depcruiseMain = guardDepcruiseMain();
const maxOldSpaceSize = process.env.DEPCRUISE_MAX_OLD_SPACE_SIZE?.trim() || "4096";
const args = [
  `--max-old-space-size=${maxOldSpaceSize}`,
  depcruiseMain,
  "packages",
  "apps",
  "--config",
  config,
  "--output-type",
  "err",
];

const r = spawnSync(process.execPath, args, {
  cwd: REPO_ROOT,
  encoding: "utf8",
  stdio: "inherit",
  env: { ...process.env, DEPCRUISE_MONOREPO_GUARD: "1" },
});

process.exit(r.status ?? 1);
