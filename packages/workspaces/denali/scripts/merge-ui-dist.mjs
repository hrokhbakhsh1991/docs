#!/usr/bin/env node
/**
 * Merge isolated UI-stage emit into dist/ without touching server runtime (acl/, wizard/, …).
 * UI tsc may emit dependency graph under dist-ui-stage/; only ui + catalog/registration-flow ship.
 */
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "dist-ui-stage");
const dist = join(root, "dist");

const mergeTargets = ["ui", "catalog/registration-flow"];

for (const rel of mergeTargets) {
  const from = join(stage, rel);
  const to = join(dist, rel);
  if (!existsSync(from)) {
    console.error(`merge-ui-dist: missing stage output ${from}`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true });
}

console.log("merge-ui-dist: OK");
