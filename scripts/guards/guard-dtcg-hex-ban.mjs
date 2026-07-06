#!/usr/bin/env node
/**
 * Phase E3–E4 — DTCG outputs must be @generated; skin hooks must not contain raw # hex.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DESIGN_TOKENS_THEMES = path.join(REPO_ROOT, "packages/design-tokens/src/themes");
const WORKSPACES_ROOT = path.join(REPO_ROOT, "packages/workspaces");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const GENERATED_RE = /@generated/;

/** @type {string[]} */
const violations = [];

/**
 * @param {string} filePath
 * @param {string} label
 * @param {{ requireGenerated?: boolean }} [options]
 */
function auditDtcgOutputCss(filePath, label, options = {}) {
  const { requireGenerated = true } = options;
  if (!existsSync(filePath)) {
    violations.push(`${label} missing`);
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const isGenerated = GENERATED_RE.test(content.slice(0, 240));
  const hexMatches = content.match(HEX_RE) ?? [];

  if (requireGenerated && !isGenerated) {
    violations.push(`${label} must be @generated from DTCG (missing header)`);
  }

  if (!isGenerated && hexMatches.length > 0) {
    violations.push(`${label} contains raw hex outside @generated CSS`);
  }
}

/**
 * @param {string} filePath
 * @param {string} label
 */
function auditSkinHookCss(filePath, label) {
  if (!existsSync(filePath)) {
    return;
  }
  const content = readFileSync(filePath, "utf8");
  const hexMatches = content.match(HEX_RE) ?? [];
  if (hexMatches.length > 0) {
    violations.push(`${label} is a skin hook — raw # hex forbidden (use DTCG semantic-tokens.css)`);
  }
}

for (const themeFile of ["light.css", "dark.css"]) {
  auditDtcgOutputCss(
    path.join(DESIGN_TOKENS_THEMES, themeFile),
    `packages/design-tokens/src/themes/${themeFile}`,
  );
}

if (!existsSync(WORKSPACES_ROOT)) {
  violations.push("packages/workspaces missing");
} else {
  for (const workspaceId of readdirSync(WORKSPACES_ROOT).sort()) {
    const themeDir = path.join(WORKSPACES_ROOT, workspaceId, "theme");
    if (!existsSync(themeDir)) {
      continue;
    }

    const tokensPath = path.join(themeDir, "tokens.css");
    if (existsSync(tokensPath)) {
      auditDtcgOutputCss(tokensPath, `packages/workspaces/${workspaceId}/theme/tokens.css`);
    }

    const marketingSemantic = path.join(themeDir, "marketing/semantic-tokens.css");
    if (existsSync(marketingSemantic)) {
      auditDtcgOutputCss(
        marketingSemantic,
        `packages/workspaces/${workspaceId}/theme/marketing/semantic-tokens.css`,
      );
    }

    const portalSemantic = path.join(themeDir, "portal-semantic-tokens.css");
    if (existsSync(portalSemantic)) {
      auditDtcgOutputCss(
        portalSemantic,
        `packages/workspaces/${workspaceId}/theme/portal-semantic-tokens.css`,
      );
    }

    const marketingHook = path.join(themeDir, "marketing/tokens.css");
    auditSkinHookCss(marketingHook, `packages/workspaces/${workspaceId}/theme/marketing/tokens.css`);

    for (const fileName of readdirSync(themeDir)) {
      if (fileName.endsWith("-portal.css")) {
        auditSkinHookCss(
          path.join(themeDir, fileName),
          `packages/workspaces/${workspaceId}/theme/${fileName}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-dtcg-hex-ban: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-dtcg-hex-ban: PASS");
