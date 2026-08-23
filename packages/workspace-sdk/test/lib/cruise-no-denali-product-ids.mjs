#!/usr/bin/env node
/**
 * Depcruise CLI runner for denali coupling contract (H-01).
 * Usage: node cruise-no-denali-product-ids.mjs <absolute-root> [more-roots...]
 * Exit 0 + "[]" on stdout when clean; exit 1 + JSON errors otherwise.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardDepcruiseMain } from "../../../../scripts/guards/lib/guard-require.mjs";

const absRoots = process.argv.slice(2);
if (absRoots.length === 0) {
  console.error("usage: cruise-no-denali-product-ids.mjs <absolute-root> [more-roots...]");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const configPath = path.join(repoRoot, "dependency-cruiser.config.js");
const { cruise } = await import(guardDepcruiseMain());

const relRoots = absRoots.map((abs) =>
  path.relative(repoRoot, abs).split(path.sep).join("/"),
);

const result = await cruise(
  relRoots,
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
  .filter((v) => v.rule?.name === "no-denali-product-ids")
  .map((v) => ({
    rule: { name: v.rule.name },
    from: v.from,
    to: v.to,
  }));

process.stdout.write(`${JSON.stringify(errors)}\n`);
process.exit(errors.length === 0 ? 0 : 1);
