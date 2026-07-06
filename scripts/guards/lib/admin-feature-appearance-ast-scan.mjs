/**
 * F7 — AST walker for admin feature TSX className palette / hex violations.
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F7
 */
import fs from "node:fs";
import path from "node:path";

import { guardRequire } from "./guard-require.mjs";
import { extractExpressionStrings } from "./shell-appearance-ast-scan.mjs";

const ts = guardRequire("typescript");

/** @type {readonly string[]} */
export const ADMIN_FEATURE_PURGED_FILES = [
  "apps/web/src/admin/patterns/booking-activity-timeline.tsx",
  "apps/web/src/admin/patterns/dashboard-kpi-cell.tsx",
  "apps/web/src/admin/patterns/denali-skeleton.tsx",
  "apps/web/src/admin/patterns/denali-empty-state.tsx",
];

/** @type {readonly string[]} */
export const ADMIN_FEATURE_SCAN_DIRS = [
  "apps/web/src/admin/patterns",
  "apps/web/src/admin/dashboard",
  "apps/web/src/admin/onboarding",
];

/** Tailwind palette scale — must use semantic tokens instead. */
const PALETTE_COLOR_PATTERN =
  /(?:^|\s)(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+(?:\/\d+)?)?/;

/** Raw white/black — use semantic foreground/background tokens. */
const RAW_NAMED_COLOR_PATTERN =
  /(?:^|\s)(?:bg|text|border|ring|fill|stroke)-(?:white|black)(?:\/\d+)?/;

/** Arbitrary hex in Tailwind brackets. */
const ARBITRARY_HEX_PATTERN = /\[#[0-9a-fA-F]{3,8}\]/;

/**
 * @param {string} classText
 * @returns {string | null}
 */
function classifyFeatureAppearanceViolation(classText) {
  const trimmed = classText.trim();
  if (!trimmed) {
    return null;
  }
  if (ARBITRARY_HEX_PATTERN.test(trimmed)) {
    return "arbitrary hex color in className";
  }
  if (PALETTE_COLOR_PATTERN.test(trimmed)) {
    return "Tailwind palette scale color (use semantic token)";
  }
  if (RAW_NAMED_COLOR_PATTERN.test(trimmed)) {
    return "raw white/black color (use semantic token)";
  }
  return null;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function collectTsxFiles(dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(abs));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(abs);
    }
  }
  return files.sort();
}

/**
 * @param {import("typescript").Node} node
 * @param {import("typescript").SourceFile} sf
 * @param {string} relPath
 * @param {string[]} violations
 */
function visitFeatureNode(node, sf, relPath, violations) {
  if (ts.isJsxAttribute(node) && node.name.getText(sf) === "className" && node.initializer) {
    /** @type {string[]} */
    let texts = [];
    if (ts.isStringLiteral(node.initializer)) {
      texts = [node.initializer.text];
    } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      texts = extractExpressionStrings(node.initializer.expression);
    }
    for (const text of texts) {
      const reason = classifyFeatureAppearanceViolation(text);
      if (reason) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        violations.push(`${relPath}:${line + 1} ${reason} — "${text.trim()}"`);
      }
    }
  }
  ts.forEachChild(node, (child) => visitFeatureNode(child, sf, relPath, violations));
}

/**
 * @param {import("typescript").Node} node
 * @param {import("typescript").SourceFile} sf
 * @param {string} relPath
 * @param {string[]} violations
 */
function visitPurgedFeatureNode(node, sf, relPath, violations) {
  if (ts.isJsxAttribute(node) && node.name.getText(sf) === "className") {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    violations.push(
      `${relPath}:${line + 1} [F8 purged] className forbidden — use data-* hooks + admin-skin.css`,
    );
  }
  ts.forEachChild(node, (child) => visitPurgedFeatureNode(child, sf, relPath, violations));
}

/**
 * @param {string} repoRoot
 * @param {readonly string[]} [purgedFiles]
 * @returns {{ violations: string[]; scanned: number }}
 */
export function scanAdminFeaturePurgedAppearance(
  repoRoot,
  purgedFiles = ADMIN_FEATURE_PURGED_FILES,
) {
  /** @type {string[]} */
  const violations = [];
  let scanned = 0;

  for (const relPath of purgedFiles) {
    const absFile = path.join(repoRoot, relPath);
    if (!fs.existsSync(absFile)) {
      violations.push(`${relPath} [F8 purged] missing file`);
      continue;
    }
    scanned += 1;
    const source = fs.readFileSync(absFile, "utf8");
    const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    visitPurgedFeatureNode(sf, sf, relPath, violations);
  }

  return { violations, scanned };
}

/**
 * @param {string} repoRoot
 * @returns {{ violations: string[]; scanned: number; purgedScanned: number }}
 */
export function scanAdminFeatureAppearanceAll(repoRoot) {
  const palette = scanAdminFeatureAppearance(repoRoot);
  const purged = scanAdminFeaturePurgedAppearance(repoRoot);
  return {
    violations: [...palette.violations, ...purged.violations],
    scanned: palette.scanned,
    purgedScanned: purged.scanned,
  };
}

/**
 * @param {string} repoRoot
 * @param {readonly string[]} [dirs]
 * @returns {{ violations: string[]; scanned: number }}
 */
export function scanAdminFeatureAppearance(repoRoot, dirs = ADMIN_FEATURE_SCAN_DIRS) {
  /** @type {string[]} */
  const violations = [];
  let scanned = 0;

  for (const relDir of dirs) {
    const absDir = path.join(repoRoot, relDir);
    for (const absFile of collectTsxFiles(absDir)) {
      const relPath = path.relative(repoRoot, absFile);
      scanned += 1;
      const source = fs.readFileSync(absFile, "utf8");
      const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      visitFeatureNode(sf, sf, relPath, violations);
    }
  }

  return { violations, scanned };
}
