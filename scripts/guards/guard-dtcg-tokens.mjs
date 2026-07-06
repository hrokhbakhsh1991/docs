#!/usr/bin/env node
/**
 * R-08 / I1 — DTCG token scaffold must exist and use valid $type/$value.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DTCG = path.join(REPO_ROOT, "packages/design-tokens/dtcg/platform.tokens.json");
const DTCG_DARK = path.join(REPO_ROOT, "packages/design-tokens/dtcg/platform.dark.tokens.json");
const STARTER_DTCG = path.join(
  REPO_ROOT,
  "packages/design-tokens/dtcg/workspaces/starter.tokens.json"
);
const STYLES_SRC = path.join(REPO_ROOT, "packages/design-tokens/src/index.css");
const DESIGN_TOKENS_PKG = path.join(REPO_ROOT, "packages/design-tokens/package.json");

/** @type {string[]} */
const violations = [];

/**
 * @param {string} filePath
 * @param {string} label
 */
function validatePlatformDtcg(filePath, label) {
  if (!existsSync(filePath)) {
    violations.push(`${label} missing`);
    return;
  }
  const raw = readFileSync(filePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    violations.push(`${label} is not valid JSON`);
    return;
  }
  if (!parsed.color?.primary?.$type || !parsed.color?.primary?.$value) {
    violations.push(`${label} must define color.primary with $type and $value`);
  }
  if (!parsed.color?.accent?.$type || !parsed.color?.accent?.$value) {
    violations.push(`${label} must define color.accent with $type and $value`);
  }
  if (!parsed.color?.["accent-fg"]?.$type || !parsed.color?.["accent-fg"]?.$value) {
    violations.push(`${label} must define color.accent-fg with $type and $value`);
  }
  if (!raw.includes("design-tokens.github.io")) {
    violations.push(`${label} must declare DTCG $schema`);
  }
}

validatePlatformDtcg(DTCG, "platform.tokens.json");
validatePlatformDtcg(DTCG_DARK, "platform.dark.tokens.json");

if (!existsSync(DTCG)) {
  violations.push("packages/design-tokens/dtcg/platform.tokens.json missing");
} else {
  const parsed = JSON.parse(readFileSync(DTCG, "utf8"));
  if (!parsed.space?.["4"]?.$value) {
    violations.push("platform.tokens.json must define space.4 dimension");
  }
  if (!parsed.radius?.md?.$value) {
    violations.push("platform.tokens.json must define radius.md dimension");
  }
}

if (!existsSync(DTCG_DARK)) {
  violations.push("packages/design-tokens/dtcg/platform.dark.tokens.json missing");
} else {
  const parsedDark = JSON.parse(readFileSync(DTCG_DARK, "utf8"));
  if (!parsedDark.shadow?.card?.$value) {
    violations.push("platform.dark.tokens.json must define shadow.card");
  }
}

if (!existsSync(STARTER_DTCG)) {
  violations.push("dtcg/workspaces/starter.tokens.json missing");
} else {
  const starter = JSON.parse(readFileSync(STARTER_DTCG, "utf8"));
  if (starter.workspaceId !== "starter") {
    violations.push("starter.tokens.json workspaceId must be starter");
  }
  if (!starter.ws?.["color-accent"]?.$value) {
    violations.push("starter.tokens.json must define ws.color-accent");
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
