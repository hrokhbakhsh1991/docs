#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const guard = path.join(REPO_ROOT, "packages/tour-core/scripts/guard-boundary.mjs");
const r = spawnSync(process.execPath, [guard], { cwd: REPO_ROOT, stdio: "inherit" });
process.exit(r.status ?? 1);
