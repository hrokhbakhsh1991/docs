#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const files = process.argv.slice(2).filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));
if (files.length === 0) {
  process.exit(0);
}

const checks = [];
const hasWeb = files.some((f) => f.startsWith("apps/web/"));
const hasApi = files.some((f) => f.startsWith("apps/api/"));
const packageNames = new Set(
  files
    .filter((f) => f.startsWith("packages/"))
    .map((f) => f.split("/")[1])
    .filter(Boolean),
);

if (hasWeb) checks.push(["pnpm", ["--filter", "@apps/web", "exec", "tsc", "--noEmit"]]);
if (hasApi) checks.push(["pnpm", ["--filter", "@apps/api", "exec", "tsc", "--noEmit"]]);
for (const pkg of packageNames) {
  checks.push(["pnpm", ["--filter", `./packages/${pkg}`, "exec", "tsc", "--noEmit"]]);
}

for (const [cmd, args] of checks) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.exit(0);
