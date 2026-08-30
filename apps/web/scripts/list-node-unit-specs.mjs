#!/usr/bin/env node
/**
 * Emit apps/web spec paths owned by node:test.
 * Classification: scripts/lib/classify-web-test-spec.mjs (canonical).
 * Playwright runtime sweep: playwright.runtime-sweep.config.ts / test:runtime-sweep.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { isNodeUnitSpec } from "../../../scripts/lib/classify-web-test-spec.mjs";

const testRoot = join(import.meta.dirname, "../test");

function collectSpecFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "e2e") continue;
      collectSpecFiles(abs, out);
    } else if (/\.spec\.tsx?$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

const webRoot = join(import.meta.dirname, "..");

const unitSpecs = collectSpecFiles(testRoot)
  .map((filePath) => filePath.slice(webRoot.length + 1))
  .filter((webRelative) => isNodeUnitSpec(webRelative))
  .sort()
  .map((webRelative) => join(webRoot, webRelative));

for (const filePath of unitSpecs) {
  process.stdout.write(`${filePath}\n`);
}
