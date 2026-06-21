#!/usr/bin/env node
/**
 * Platform Control Center UI smoke — structural checks for /platform shell.
 *
 * Run: node apps/web/scripts/smoke-platform-ui.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const required = [
  "app/(platform)/platform/page.tsx",
  "app/(platform)/platform/clubs/page.tsx",
  "app/(platform)/platform/team/page.tsx",
  "app/(platform)/platform/audit/page.tsx",
  "src/platform/platform-nav.ts",
  "app/api/platform/team/route.ts",
];

for (const relative of required) {
  const full = path.join(webDir, relative);
  assert.ok(existsSync(full), `missing ${relative}`);
}

const nav = readFileSync(path.join(webDir, "src/platform/platform-nav.ts"), "utf8");
assert.match(nav, /\/platform/);
assert.match(nav, /\/platform\/team/);

console.log("smoke-platform-ui: structural checks passed");
console.log("");
console.log("Manual smoke (dev):");
console.log("1. Open http://admin.localhost:3000/platform");
console.log("2. Confirm nav: Overview, Clubs, Audit, Team, Settings");
