#!/usr/bin/env node
/**
 * Depcruise runner for finance-core boundary rules (Phase 2.2.2).
 * Usage: node cruise-finance-core.mjs <absolute-root-or-file> [more...]
 * Exit 0 + "[]" when no finance-core-* violations; exit 1 + JSON otherwise.
 * Does NOT set DEPCRUISE_MONOREPO_GUARD (fixtures are included when targeted).
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { guardDepcruiseBin } from "../../../scripts/guards/lib/guard-require.mjs";

const absRoots = process.argv.slice(2);
if (absRoots.length === 0) {
  console.error("usage: cruise-finance-core.mjs <absolute-root-or-file> [more...]");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "dependency-cruiser.config.js");
const depcruiseBin = guardDepcruiseBin();

const relRoots = absRoots.map((abs) =>
  path.relative(repoRoot, abs).split(path.sep).join("/")
);

const r = spawnSync(
  depcruiseBin,
  [...relRoots, "--config", configPath, "--output-type", "json"],
  {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }
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
const FINANCE_CORE_RULE =
  /^finance-core-(no-apps|no-workspaces|no-workspace-packages|no-generated|no-db-infra|no-prisma|allowed-package-deps)$/;

const errors = violations
  .filter((v) => FINANCE_CORE_RULE.test(v.rule?.name ?? ""))
  .map((v) => ({
    rule: { name: v.rule.name },
    from: v.from,
    to: v.to,
  }));

process.stdout.write(`${JSON.stringify(errors)}\n`);
process.exit(errors.length === 0 ? 0 : 1);
