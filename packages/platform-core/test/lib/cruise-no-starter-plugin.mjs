#!/usr/bin/env node
/**
 * Depcruise runner for platform-core-no-workspace-starter-plugin (Phase 1).
 * Usage: node cruise-no-starter-plugin.mjs
 * Exit 0 + "[]" when clean; exit 1 + JSON errors otherwise.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { guardDepcruiseBin } from "../../../../scripts/guards/lib/guard-require.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const configPath = path.join(repoRoot, "dependency-cruiser.config.js");
const depcruiseBin = guardDepcruiseBin();
const cruiseTarget = "packages/platform-core/src";

const r = spawnSync(
  depcruiseBin,
  [cruiseTarget, "--config", configPath, "--output-type", "json"],
  {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (r.error) {
  console.error(r.error.message);
  process.exit(2);
}

const stdout = (r.stdout ?? "").trim();
if (!stdout) {
  console.error((r.stderr ?? "depcruise produced no output").trim());
  process.exit(2);
}

const payload = JSON.parse(stdout);
const violations = payload?.summary?.violations ?? [];
const errors = violations
  .filter((v) => v.rule?.name === "platform-core-no-workspace-starter-plugin")
  .map((v) => ({
    rule: { name: v.rule.name },
    from: v.from,
    to: v.to,
  }));

process.stdout.write(`${JSON.stringify(errors)}\n`);
process.exit(errors.length === 0 ? 0 : 1);
