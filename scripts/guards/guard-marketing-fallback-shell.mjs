#!/usr/bin/env node
/**
 * G-P6-UI-01d / MKT-21 — platform fallback marketing shell CSS in design-tokens.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOKENS = path.join(REPO_ROOT, "packages/design-tokens");
const FALLBACK = path.join(TOKENS, "src/fallback-guest-marketing-shell.css");
const MARKETING_BOOTSTRAP = path.join(TOKENS, "src/marketing-bootstrap.css");
const PKG = path.join(TOKENS, "package.json");
const BUILD = path.join(TOKENS, "scripts/build.mjs");

/** @type {string[]} */
const violations = [];

const marketingBootstrap = readFileSync(MARKETING_BOOTSTRAP, "utf8");
const pkg = readFileSync(PKG, "utf8");
const build = readFileSync(BUILD, "utf8");
const fallback = readFileSync(FALLBACK, "utf8");

if (!marketingBootstrap.includes("fallback-guest-marketing-shell.css")) {
  violations.push("marketing-bootstrap.css must import fallback-guest-marketing-shell.css");
}
if (!pkg.includes("./marketing-bootstrap.css")) {
  violations.push("design-tokens package.json must export marketing-bootstrap.css");
}
if (!build.includes("marketing-bootstrap.css")) {
  violations.push("design-tokens build.mjs must copy marketing-bootstrap.css");
}
if (!fallback.includes("body[data-app-surface=\"marketing\"]")) {
  violations.push("fallback-guest-marketing-shell.css must scope to marketing body");
}

if (violations.length > 0) {
  console.error("guard-marketing-fallback-shell: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-fallback-shell: PASS");
