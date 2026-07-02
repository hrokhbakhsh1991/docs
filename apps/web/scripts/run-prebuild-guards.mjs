#!/usr/bin/env node
/**
 * Web prebuild guards — skipped when smoke/Playwright spawns `next build`
 * (guards already run in phase gates; smoke must not require ripgrep on PATH).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

if (process.env.WEB_SKIP_GUARD_PREBUILD === "1") {
  console.log("web-prebuild: skip guards (WEB_SKIP_GUARD_PREBUILD=1)");
  process.exit(0);
}

const draftEngineBuild = spawnSync(
  "pnpm",
  ["--filter", "@app-tour/draft-engine", "run", "build"],
  { cwd: REPO_ROOT, stdio: "inherit" }
);
if (draftEngineBuild.status !== 0) {
  process.exit(draftEngineBuild.status ?? 1);
}

for (const script of [
  "guard:import-boundary",
  "audit-boundary",
  "guard:no-raw-wizard-input",
]) {
  const result = spawnSync("pnpm", ["run", script], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
