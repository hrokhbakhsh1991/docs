#!/usr/bin/env node
/**
 * Phase 3.4 — standalone canonical/legacy consistency check (CI hook).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const r = spawnSync(
  "pnpm",
  ["exec", "tsx", "--test", "src/canonical/canonical-sync-validator.spec.ts", "src/canonical/legacy-canonical-adapter.spec.ts"],
  { cwd: ROOT, encoding: "utf8", shell: true },
);

if (r.status !== 0) {
  process.stderr.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  process.exit(r.status ?? 1);
}

console.log("validate-canonical-sync: PASS");
