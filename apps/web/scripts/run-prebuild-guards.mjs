#!/usr/bin/env node
/**
 * Web prebuild guards — skipped when smoke/Playwright spawns `next build`
 * (guards already run in phase gates; smoke must not require ripgrep on PATH).
 */
import { spawnSync } from "node:child_process";

if (process.env.WEB_SKIP_GUARD_PREBUILD === "1") {
  console.log("web-prebuild: skip guards (WEB_SKIP_GUARD_PREBUILD=1)");
  process.exit(0);
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
