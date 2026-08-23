/**
 * CW3-08 — publish-transition detector consumer census.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const API_SRC = join(REPO_ROOT, "apps/api/src");

/** @param {string} dir */
function walkTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(abs));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(abs);
    }
  }
  return files;
}

function isExcluded(rel: string): boolean {
  return rel.endsWith(".generated.ts") || rel.includes("/test/");
}

describe("CW3-08 publish-transition detector consumer census", () => {
  it("CW3-08-01 detectTourPublishTransition consumers import only dispatch or audit re-export", () => {
    const allowedImportSources = new Set([
      "./workspace-canonical-tour-dispatch.ts",
      "./workspace-canonical-tour-dispatch",
      "../canonical/workspace-canonical-tour-dispatch.ts",
      "../canonical/workspace-canonical-tour-dispatch",
      "./tour-publish-transition-audit.ts",
      "./tour-publish-transition-audit",
      "../canonical/tour-publish-transition-audit.ts",
      "../canonical/tour-publish-transition-audit",
    ]);

    const violations: string[] = [];
    for (const abs of walkTsFiles(API_SRC)) {
      const rel = abs.slice(REPO_ROOT.length + 1);
      if (isExcluded(rel)) {
        continue;
      }
      const source = readFileSync(abs, "utf8");
      if (!source.includes("detectTourPublishTransition")) {
        continue;
      }
      if (rel === "apps/api/src/canonical/workspace-canonical-tour-dispatch.ts") {
        continue;
      }
      if (rel === "apps/api/src/canonical/tour-publish-transition-audit.ts") {
        continue;
      }
      const importMatch = source.match(
        /import\s*\{[^}]*detectTourPublishTransition[^}]*\}\s*from\s*["']([^"']+)["']/,
      );
      if (importMatch === null) {
        violations.push(`${rel}: references detectTourPublishTransition without import`);
        continue;
      }
      if (!allowedImportSources.has(importMatch[1])) {
        violations.push(`${rel}: forbidden import source ${importMatch[1]}`);
      }
    }

    assert.deepEqual(violations, []);
  });

  it("CW3-08-02 no direct workspace package publish-transition imports in API host", () => {
    const forbiddenPatterns = [
      /@app-tour\/workspace-denali.*detect.*Publish/,
      /@app-tour\/workspace-urban.*detect.*Publish/,
      /@app-tour\/workspace-harbor.*detect.*Publish/,
      /detectDenaliTourPublishTransition/,
      /detectUrbanTourPublishTransition/,
      /detectHarborTourPublishTransition/,
    ];
    const violations: string[] = [];
    for (const abs of walkTsFiles(API_SRC)) {
      const rel = abs.slice(REPO_ROOT.length + 1);
      if (isExcluded(rel)) {
        continue;
      }
      const source = readFileSync(abs, "utf8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(source)) {
          violations.push(`${rel}: matches ${pattern}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
