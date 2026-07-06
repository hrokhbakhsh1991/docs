#!/usr/bin/env node
/**
 * Ensures workspace package.json exports every guestThemeStylesheets path from manifest.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES = path.join(REPO_ROOT, "packages/workspaces");

/** @type {string[]} */
const violations = [];

for (const id of readdirSync(WORKSPACES)) {
  const manifestPath = path.join(WORKSPACES, id, "workspace.manifest.json");
  const pkgPath = path.join(WORKSPACES, id, "package.json");
  if (!existsSync(manifestPath) || !existsSync(pkgPath)) {
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const exports = pkg.exports ?? {};
  const guestSkins = manifest.guestThemeStylesheets ?? {};

  for (const surface of Object.keys(guestSkins)) {
    for (const relative of guestSkins[surface]) {
      const exportKey = `./${relative}`;
      if (!exports[exportKey]) {
        violations.push(`${id}: package.json missing export "${exportKey}" (${surface} skin)`);
      }
      const abs = path.join(WORKSPACES, id, relative);
      if (!existsSync(abs)) {
        violations.push(`${id}: missing skin file ${relative}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-workspace-theme-exports: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-workspace-theme-exports: PASS");
