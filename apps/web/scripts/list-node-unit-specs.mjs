#!/usr/bin/env node
/**
 * Emit apps/web spec paths owned by node:test.
 * Excludes test/e2e (Playwright platform smoke) and any *.spec.* that imports @playwright/test
 * (Playwright runtime sweep — see playwright.runtime-sweep.config.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

function isPlaywrightRuntimeSpec(filePath) {
  return readFileSync(filePath, "utf8").includes("@playwright/test");
}

const unitSpecs = collectSpecFiles(testRoot)
  .filter((filePath) => !isPlaywrightRuntimeSpec(filePath))
  .sort();

for (const filePath of unitSpecs) {
  process.stdout.write(`${filePath}\n`);
}
