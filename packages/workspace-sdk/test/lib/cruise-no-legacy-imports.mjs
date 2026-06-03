#!/usr/bin/env node
/**
 * Depcruise CLI runner for legacy-import contract tests.
 * Usage: node cruise-no-legacy-imports.mjs <absolute-package-root>
 * Exit 0 + "[]" on stdout when clean; exit 1 + JSON errors otherwise.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { guardDepcruiseBin } from "../../../../scripts/guards/lib/guard-require.mjs";

const absRoot = process.argv[2];
if (!absRoot) {
  console.error("usage: cruise-no-legacy-imports.mjs <absolute-package-root>");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const configPath = path.join(repoRoot, "dependency-cruiser.config.js");
const depcruiseBin = guardDepcruiseBin();
const relRoot = path.relative(repoRoot, absRoot).split(path.sep).join("/");

const r = spawnSync(
  depcruiseBin,
  [relRoot, "--config", configPath, "--output-type", "json"],
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
  .filter((v) => v.rule?.name === "no-legacy-imports")
  .map((v) => ({
    rule: { name: v.rule.name },
    from: v.from,
    to: v.to,
  }));

process.stdout.write(`${JSON.stringify(errors)}\n`);
process.exit(errors.length === 0 ? 0 : 1);
