#!/usr/bin/env node
/**
 * PSR-3a — assert the twelve public front doors resolve in root package.json.
 * Does not run verify:full, db:migrate, generate, or heavy gates.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;

const doors = [
  "dev",
  "build",
  "lint",
  "typecheck",
  "test",
  "verify:fast",
  "verify:product",
  "verify:full",
  "generate",
  "workspace:create",
  "db:migrate",
  "release:verify",
];

const missing = doors.filter((k) => !scripts[k]);
if (missing.length) {
  console.error("front-doors: missing", missing.join(", "));
  process.exit(1);
}

const forbidden = ["contract:test", "test:contract:foundation"].filter((k) => scripts[k]);
if (forbidden.length) {
  console.error("front-doors: removed aliases still executable", forbidden.join(", "));
  process.exit(1);
}

const expect = {
  typecheck: "pnpm run lint",
  generate: "pnpm run generate:workspace-registry",
  "db:migrate": "pnpm run db:migrate:deploy",
  "release:verify": "pnpm run verify:product",
};
for (const [k, v] of Object.entries(expect)) {
  if (scripts[k] !== v) {
    console.error(`front-doors: ${k} expected ${v}, got ${scripts[k]}`);
    process.exit(1);
  }
}

if (scripts["verify:fast"] === scripts["verify:product"] || scripts["verify:product"] === scripts["verify:full"]) {
  console.error("front-doors: verify tiers must remain distinct bodies");
  process.exit(1);
}

console.log("front-doors: present (12)");
console.log("  release:verify →", scripts["release:verify"]);
console.log("  generate →", scripts.generate);
console.log("  db:migrate →", scripts["db:migrate"], "(DB side effect — not executed here)");
console.log("  typecheck →", scripts.typecheck);
