#!/usr/bin/env node
/**
 * Depcruise CLI runner for legacy-import contract tests.
 * Usage: node cruise-no-legacy-imports.mjs <absolute-package-root>
 * Exit 0 + "[]" on stdout when clean; exit 1 + JSON errors otherwise.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardDepcruiseMain } from "../../../../scripts/guards/lib/guard-require.mjs";

const absRoot = process.argv[2];
if (!absRoot) {
  console.error("usage: cruise-no-legacy-imports.mjs <absolute-package-root>");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const configPath = path.join(repoRoot, "dependency-cruiser.config.js");
const { cruise } = await import(guardDepcruiseMain());
const relRoot = path.relative(repoRoot, absRoot).split(path.sep).join("/");

const result = await cruise(
  [relRoot],
  {
    outputType: "json",
    config: { extends: configPath },
  },
  { bustTheCache: true },
);

const stdout = String(result?.output ?? "").trim();
if (!stdout) {
  console.error("depcruise produced no output");
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
