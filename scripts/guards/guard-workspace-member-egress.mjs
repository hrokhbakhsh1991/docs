#!/usr/bin/env node
/**
 * PS-4 — workspace registration flow member egress guard (DL-38).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_SRC = path.join(REPO_ROOT, "packages/workspaces");

/** @type {string[]} */
const violations = [];

const hardcodedMemberPath = /href=["'`]\/me\//;

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      scanDir(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".tsx") && !entry.name.endsWith(".ts")) {
      continue;
    }
    if (!fullPath.includes(`${path.sep}registration-flow${path.sep}`)) {
      continue;
    }
    const source = fs.readFileSync(fullPath, "utf8");
    if (hardcodedMemberPath.test(source)) {
      violations.push(`${path.relative(REPO_ROOT, fullPath)}: hardcoded /me/ href`);
    }
  }
}

scanDir(WORKSPACES_SRC);

if (violations.length > 0) {
  console.error("guard-workspace-member-egress: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-workspace-member-egress: PASS");
