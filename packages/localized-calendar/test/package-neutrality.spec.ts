import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_PATTERNS = [
  /intake-submit/i,
  /member-profile/i,
  /data-intake-field/i,
  /data-member-profile-field/i,
  /portal\.operator/i,
  /\/me\/profile/i,
  /catalog\/registrations/i,
] as const;

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      files.push(...listSourceFiles(absPath));
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".css")) {
      files.push(absPath);
    }
  }
  return files;
}

describe("@app-tour/localized-calendar package neutrality (LC-NEUTRAL)", () => {
  it("LC-NEUTRAL-01 source has zero Portal/Profile/Intake selector or route references", () => {
    const roots = [join(packageRoot, "src"), join(packageRoot, "theme")];
    const violations: string[] = [];

    for (const root of roots) {
      for (const filePath of listSourceFiles(root)) {
        const relPath = filePath.slice(packageRoot.length + 1);
        const source = readFileSync(filePath, "utf8");
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(source)) {
            violations.push(`${relPath} matches ${pattern}`);
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `localized-calendar must stay surface-neutral:\n${violations.join("\n")}`
    );
  });

  it("LC-NEUTRAL-02 placement hook defaults to no collision selectors", () => {
    const hook = readFileSync(join(packageRoot, "src/use-calendar-popover-placement.ts"), "utf8");
    assert.doesNotMatch(hook, /intake-submit/);
    assert.doesNotMatch(hook, /member-profile/);
    assert.match(hook, /collisionSelectors: readonly string\[\] = \[\]/);
  });

  it("LC-NEUTRAL-03 root barrel does not import React pickers or ui-primitives", () => {
    const index = readFileSync(join(packageRoot, "src/index.ts"), "utf8");
    assert.doesNotMatch(index, /from ["']\.\/localized-date-picker["']/);
    assert.doesNotMatch(index, /from ["']\.\/solar-hijri-calendar["']/);
    assert.doesNotMatch(index, /ui-primitives/);
    assert.doesNotMatch(index, /from ["']\.\/use-calendar-popover-placement["']/);
  });
});
