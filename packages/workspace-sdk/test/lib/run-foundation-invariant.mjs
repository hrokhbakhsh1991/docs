#!/usr/bin/env node
/**
 * Run a single foundation invariant spec via Node test runner.
 * Usage: node run-foundation-invariant.mjs <absolute-spec-path>
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const absSpec = process.argv[2];
if (!absSpec) {
  console.error("usage: run-foundation-invariant.mjs <absolute-spec-path>");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sdkRoot = path.join(repoRoot, "packages/workspace-sdk");

const stubPath = path.join(sdkRoot, "test/register-server-only-stub.mjs");

const r = spawnSync(
  process.execPath,
  ["--import", stubPath, "--import", "tsx", "--test", absSpec],
  {
  cwd: sdkRoot,
  encoding: "utf8",
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "test" },
});

process.exit(r.status ?? 1);
