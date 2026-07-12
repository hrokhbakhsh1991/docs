#!/usr/bin/env node
/**
 * Run one contract spec in an isolated Node subprocess (UT-01).
 * Usage: node run-contract-subprocess.mjs <specRel> [legacyScanScope]
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const specRel = process.argv[2];
const legacyScope = process.argv[3] ?? "foundation";

if (!specRel) {
  console.error("usage: run-contract-subprocess.mjs <specRel> [legacyScanScope]");
  process.exit(2);
}

const sdkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const specPath = path.join(sdkRoot, specRel);

const env = {
  NODE_ENV: "test",
  LEGACY_IMPORT_SCAN_SCOPE: legacyScope,
};
if (process.env.PATH) {
  env.PATH = process.env.PATH;
}

const stubPath = path.join(sdkRoot, "test/register-server-only-stub.mjs");

const r = spawnSync(
  process.execPath,
  ["--import", stubPath, "--import", "tsx", "--test", specPath],
  {
  cwd: sdkRoot,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  env,
});

const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim();
if (r.status === 0) {
  process.stdout.write("CONTRACT_SUBPROCESS_OK\n");
  process.exit(0);
}

process.stderr.write(out.slice(-8000) || `exit ${r.status ?? "unknown"}\n`);
process.exit(r.status ?? 1);
