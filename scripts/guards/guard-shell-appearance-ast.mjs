#!/usr/bin/env node
/**
 * I0 — AST shell appearance linter (marketing + portal + admin).
 * Replaces regex-only per-file guards with a shared TypeScript walker.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanShellAppearance } from "./lib/shell-appearance-ast-scan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { violations, scanned } = scanShellAppearance(REPO_ROOT);

if (violations.length > 0) {
  console.error("guard-shell-appearance-ast: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log(`guard-shell-appearance-ast: PASS (${scanned} shell files)`);
