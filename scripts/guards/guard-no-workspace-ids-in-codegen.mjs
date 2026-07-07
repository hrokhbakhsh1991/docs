#!/usr/bin/env node
/**
 * Phase B — member portal codegen must not branch on workspace ids or workspace-named presets.
 * @see docs/architecture/platform-architecture-v2.md §10
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {{ file: string; patterns: RegExp[] }}[] */
const TARGETS = [
  {
    file: "scripts/codegen/workspace-registry/domains/member-portal.mjs",
    patterns: [
      /manifest\.id\s*===\s*["'](?:denali|urban|guest-club)["']/,
      /["'](?:denali|urban|guest-club)-(?:full|minimal)-v\d+["']/,
      /["']denali-full-v1["']/,
    ],
  },
  {
    file: "scripts/guards/guard-member-portal-contract.mjs",
    patterns: [/manifest\.id\s*===\s*["'](?:denali|urban|guest-club)["']/],
  },
];

/** @type {string[]} */
const violations = [];

for (const { file, patterns } of TARGETS) {
  const abs = path.join(REPO_ROOT, file);
  const text = readFileSync(abs, "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        violations.push(`${file}:${i + 1}: forbidden workspace id pattern — ${line.trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-workspace-ids-in-codegen: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-no-workspace-ids-in-codegen: PASS");
