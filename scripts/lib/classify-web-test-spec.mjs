#!/usr/bin/env node
/**
 * Canonical apps/web spec ownership: node:test vs Playwright runtime vs Playwright e2e.
 * Used by list-node-unit-specs, resolve-web-test-specs, and test:file wrapper.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const WEB_ROOT = join(REPO_ROOT, "apps/web");

export const SpecKind = {
  NODE_UNIT: "NODE_UNIT",
  PLAYWRIGHT_RUNTIME: "PLAYWRIGHT_RUNTIME",
  PLAYWRIGHT_E2E: "PLAYWRIGHT_E2E",
};

/**
 * @param {string} webRelativeSpec path under apps/web (e.g. test/foo.spec.ts)
 * @returns {typeof SpecKind[keyof typeof SpecKind]}
 */
export function classifyWebTestSpec(webRelativeSpec) {
  const normalized = webRelativeSpec.replace(/\\/g, "/");
  if (normalized.startsWith("test/e2e/")) {
    return SpecKind.PLAYWRIGHT_E2E;
  }
  if (!/\.spec\.tsx?$/.test(normalized)) {
    return SpecKind.NODE_UNIT;
  }
  const absolute = join(WEB_ROOT, normalized);
  if (!existsSync(absolute)) {
    return SpecKind.NODE_UNIT;
  }
  if (readFileSync(absolute, "utf8").includes("@playwright/test")) {
    return SpecKind.PLAYWRIGHT_RUNTIME;
  }
  return SpecKind.NODE_UNIT;
}

export function isNodeUnitSpec(webRelativeSpec) {
  return classifyWebTestSpec(webRelativeSpec) === SpecKind.NODE_UNIT;
}

export function isPlaywrightRuntimeSpec(webRelativeSpec) {
  return classifyWebTestSpec(webRelativeSpec) === SpecKind.PLAYWRIGHT_RUNTIME;
}
