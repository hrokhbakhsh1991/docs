/**
 * Denali flat-edit section mount — delegates to jsdom perf spec.
 * Run: pnpm --filter @apps/web run bench:denali:section-mount
 */
/* eslint-disable no-console -- CLI benchmark */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
);

function main(): void {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "jest",
      "--config",
      "jest.pbt.config.js",
      "--testPathPatterns=denali-section-mount.perf",
      "--runInBand",
    ],
    {
      cwd: WEB_ROOT,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log("denali-section-mount bench OK (jsdom perf spec passed)");
}

main();
