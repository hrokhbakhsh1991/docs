#!/usr/bin/env node
/**
 * Run full-repo dependency-cruiser from @app-tour/guards local node_modules.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { guardDepcruiseBin, REPO_ROOT } from "./guard-require.mjs";

const config = path.join(REPO_ROOT, "dependency-cruiser.config.js");
const bin = guardDepcruiseBin();
const args = [
  "packages",
  "apps",
  "--config",
  config,
  "--output-type",
  "err",
];

const r = spawnSync(bin, args, {
  cwd: REPO_ROOT,
  encoding: "utf8",
  stdio: "inherit",
  env: { ...process.env, DEPCRUISE_MONOREPO_GUARD: "1" },
});

process.exit(r.status ?? 1);
