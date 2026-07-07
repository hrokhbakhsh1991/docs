#!/usr/bin/env node
/**
 * MKT-LOCALE-01 — locale switcher wired in marketing shell toolbar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHELL = path.join(REPO_ROOT, "apps/marketing/src/shell/marketing-shell.tsx");

const source = readFileSync(SHELL, "utf8");

if (!source.includes("MarketingLocaleSwitcher")) {
  console.error("guard-marketing-locale: FAIL — MarketingLocaleSwitcher not mounted in marketing-shell.tsx");
  process.exit(1);
}
if (!source.includes('data-slot="shell-toolbar"')) {
  console.error("guard-marketing-locale: FAIL — shell-toolbar landmark missing");
  process.exit(1);
}

console.log("guard-marketing-locale: PASS");
