#!/usr/bin/env node
/**
 * I4 — operator shell chrome must not use appearance className (AST; superseded by I0 pack).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanShellAppearance } from "./lib/shell-appearance-ast-scan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { violations } = scanShellAppearance(REPO_ROOT, [
  {
    surface: "admin",
    files: ["apps/web/src/admin/shell/operator-shell.tsx"],
  },
]);

if (violations.length > 0) {
  console.error("guard-admin-shell-i4: BLOCKED I4");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-admin-shell-i4: PASS");
