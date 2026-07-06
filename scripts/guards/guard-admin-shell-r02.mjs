#!/usr/bin/env node
/**
 * R-02 — admin operator shell root must not use appearance className (I4 expands scope).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHELL = path.join(REPO_ROOT, "apps/web/src/admin/shell/operator-shell.tsx");

const source = readFileSync(SHELL, "utf8");
const rootMatch = source.match(
  /<div[\s\S]*?data-operator-shell[\s\S]*?data-slot="shell"[\s\S]*?>/
);
const APPEARANCE =
  /className=\{?("|\{)[^"]*(?:bg-|text-|border-|shadow-|backdrop-|rounded-|font-|px-|py-|gap-|flex |min-h-|sr-only|focus:)/;

/** @type {string[]} */
const violations = [];

if (!rootMatch) {
  violations.push("R-02: operator-shell root must expose data-operator-shell + data-slot=shell");
} else if (APPEARANCE.test(rootMatch[0])) {
  violations.push("R-02: operator-shell root div contains appearance className");
}

if (violations.length > 0) {
  console.error("guard-admin-shell-r02: BLOCKED R-02");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-admin-shell-r02: PASS (root scope; I4 pending for chrome)");
