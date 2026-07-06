#!/usr/bin/env node
/**
 * R-08 / I1 — DTCG token scaffold must exist and use valid $type/$value.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DTCG = path.join(REPO_ROOT, "packages/design-tokens/dtcg/platform.tokens.json");
const STYLES_SRC = path.join(REPO_ROOT, "packages/design-tokens/src/index.css");
const DESIGN_TOKENS_PKG = path.join(REPO_ROOT, "packages/design-tokens/package.json");

/** @type {string[]} */
const violations = [];

if (!existsSync(DTCG)) {
  violations.push("packages/design-tokens/dtcg/platform.tokens.json missing");
} else {
  const raw = readFileSync(DTCG, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    violations.push("platform.tokens.json is not valid JSON");
    parsed = null;
  }
  if (parsed != null) {
    if (!parsed.color?.primary?.$type || !parsed.color?.primary?.$value) {
      violations.push("platform.tokens.json must define color.primary with $type and $value");
    }
    if (!parsed.color?.accent?.$type || !parsed.color?.accent?.$value) {
      violations.push("platform.tokens.json must define color.accent with $type and $value");
    }
    if (!parsed.color?.["accent-fg"]?.$type || !parsed.color?.["accent-fg"]?.$value) {
      violations.push("platform.tokens.json must define color.accent-fg with $type and $value");
    }
    if (!parsed.space?.["4"]?.$value) {
      violations.push("platform.tokens.json must define space.4 dimension");
    }
    if (!parsed.radius?.md?.$value) {
      violations.push("platform.tokens.json must define radius.md dimension");
    }
    if (!raw.includes("design-tokens.github.io")) {
      violations.push("platform.tokens.json must declare DTCG $schema");
    }
  }
}

if (!existsSync(STYLES_SRC)) {
  violations.push("packages/design-tokens/src/index.css missing (CSS source entry)");
} else {
  const pkg = JSON.parse(readFileSync(DESIGN_TOKENS_PKG, "utf8"));
  const stylesExport = pkg.exports?.["./styles.css"];
  if (typeof stylesExport !== "string" || !stylesExport.includes("index.css")) {
    violations.push(
      'packages/design-tokens/package.json must export "./styles.css" → dist/index.css'
    );
  }
}

if (violations.length > 0) {
  console.error("guard-dtcg-tokens: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-dtcg-tokens: PASS");
