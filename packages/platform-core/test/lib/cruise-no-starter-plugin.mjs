#!/usr/bin/env node
/**
 * Depcruise runner for platform-core-no-workspace-starter-plugin (Phase 1).
 * Usage: node cruise-no-starter-plugin.mjs
 * Exit 0 + "[]" when clean; exit 1 + JSON errors otherwise.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardDepcruiseMain } from "../../../../scripts/guards/lib/guard-require.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const configPath = path.join(repoRoot, "dependency-cruiser.config.js");
const { cruise } = await import(guardDepcruiseMain());
const cruiseTarget = "packages/platform-core/src";

const result = await cruise(
  [cruiseTarget],
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
  .filter((v) => v.rule?.name === "platform-core-no-workspace-starter-plugin")
  .map((v) => ({
    rule: { name: v.rule.name },
    from: v.from,
    to: v.to,
  }));

process.stdout.write(`${JSON.stringify(errors)}\n`);
process.exit(errors.length === 0 ? 0 : 1);
