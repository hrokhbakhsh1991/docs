#!/usr/bin/env node
/**
 * Marketing home hooks + ADR-MKT-004 static closure.
 * @see docs/workspaces/denali/marketing-landing.mdoc §34
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

function read(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function fail(message) {
  violations.push(message);
}

function walkTsx(dirRel) {
  /** @type {string[]} */
  const files = [];
  const dir = path.join(REPO_ROOT, dirRel);
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dirRel, name.name);
    if (name.isDirectory()) {
      files.push(...walkTsx(rel));
      continue;
    }
    if (/\.tsx?$/.test(name.name)) {
      files.push(rel);
    }
  }
  return files;
}

function sourceIncludesHook(dirRel, hook) {
  return walkTsx(dirRel).some((rel) => read(rel).includes(hook));
}

const HOME_HOOKS = [
  "data-marketing-home-hero",
  "data-marketing-home-search",
  "data-marketing-home-featured",
  "data-marketing-home-latest",
  "data-marketing-home-categories",
  "data-marketing-home-destinations",
  "data-marketing-home-trust",
  "data-marketing-home-why",
  "data-marketing-home-journey",
  "data-marketing-home-testimonials",
  "data-marketing-home-gallery",
  "data-marketing-home-equipment",
  "data-marketing-home-blog",
  "data-marketing-home-faq",
  "data-marketing-home-final-cta",
];

const SHELL_HOOKS = [
  "data-marketing-footer",
  "data-marketing-nav-drawer",
  "data-marketing-skip-link",
];

const FORBIDDEN = [
  /pluginId\s*===\s*["']denali["']/,
  /DenaliHomeFull/,
  /header\[data-marketing-home-header\]/,
  /data-marketing-catalog-card/,
];

for (const hook of HOME_HOOKS) {
  if (!sourceIncludesHook("apps/marketing/src/home", hook)) {
    fail(`apps/marketing/src/home must define hook ${hook}`);
  }
}

for (const hook of SHELL_HOOKS) {
  if (!sourceIncludesHook("apps/marketing/src/shell", hook)) {
    fail(`apps/marketing/src/shell must define hook ${hook}`);
  }
}

for (const rel of walkTsx("apps/marketing/src/home")) {
  const source = read(rel);
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source)) {
      fail(`${rel} matches forbidden pattern ${pattern}`);
    }
  }
}

const smokePath = "apps/marketing/tests/e2e/marketing-home-smoke.spec.ts";
if (!existsSync(path.join(REPO_ROOT, smokePath))) {
  fail(`${smokePath} is required`);
} else {
  const smoke = read(smokePath);
  for (const id of [
    "SMK-MKT-HOME-01",
    "SMK-MKT-HOME-02",
    "SMK-MKT-HOME-03",
    "SMK-MKT-HOME-05",
    "SMK-MKT-HOME-06",
    "SMK-MKT-HOME-07",
    "SMK-MKT-HOME-08",
  ]) {
    if (!smoke.includes(id)) {
      fail(`${smokePath} must include ${id}`);
    }
  }
}

const catalogUiDoc = read("docs/workspaces/denali/marketing-catalog-ui.md");
for (const hook of [...HOME_HOOKS, ...SHELL_HOOKS]) {
  if (!catalogUiDoc.includes(hook)) {
    fail(`marketing-catalog-ui.md must document ${hook}`);
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-home-hooks: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-marketing-home-hooks: PASS");
