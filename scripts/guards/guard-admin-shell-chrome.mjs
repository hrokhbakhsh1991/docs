#!/usr/bin/env node
/**
 * R-07 — admin shell chrome (header + nav) must not use appearance className (AST).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanShellAppearance } from "./lib/shell-appearance-ast-scan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { violations } = scanShellAppearance(REPO_ROOT, [
  {
    surface: "admin",
    files: [
      "apps/web/src/admin/shell/operator-header.tsx",
      "apps/web/src/admin/shell/operator-nav.tsx",
      "apps/web/src/admin/shell/operator-account-menu.tsx",
    ],
  },
]);

if (violations.length > 0) {
  console.error("guard-admin-shell-chrome: BLOCKED R-07");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-admin-shell-chrome: PASS (header + nav + account menu)");
