#!/usr/bin/env node
/**
 * Count platform-core test cases that exercise the public facade path.
 * A spec file counts as facade when it imports PlatformWizardEngine or loadPlatformWizard.
 */
import fs from "node:fs";
import path from "node:path";

const FACADE_SIGNAL_RE = /PlatformWizardEngine|loadPlatformWizard/;

/**
 * @param {string} packageTestRoot absolute path to packages/platform-core/test
 */
export function measureFacadeTestRatio(packageTestRoot) {
  let total = 0;
  let facade = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".spec.ts")) {
        continue;
      }
      const rel = path.relative(packageTestRoot, full).replaceAll("\\", "/");
      if (rel.startsWith("unit/")) {
        continue;
      }
      const content = fs.readFileSync(full, "utf8");
      const cases = (content.match(/\bit\s*\(/g) ?? []).length;
      total += cases;
      if (FACADE_SIGNAL_RE.test(content)) {
        facade += cases;
      }
    }
  }

  walk(packageTestRoot);
  const ratio = total === 0 ? 0 : facade / total;
  return { total, facade, ratio };
}
