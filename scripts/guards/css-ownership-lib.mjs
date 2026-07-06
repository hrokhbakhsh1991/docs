/**
 * Shared helpers for CSS ownership guards.
 */
import fs from "node:fs";
import path from "node:path";

const IMPORT_RE = /@import\s+["']([^"']+)["']/g;

/** @param {string} repoRoot */
/** @param {string} cssPath absolute */
export function readCssImportTree(repoRoot, cssPath, visited = new Set()) {
  const normalized = path.normalize(cssPath);
  if (visited.has(normalized)) {
    return [];
  }
  visited.add(normalized);
  if (!fs.existsSync(normalized)) {
    return [{ path: normalized, missing: true, content: "" }];
  }
  const content = fs.readFileSync(normalized, "utf8");
  const files = [{ path: normalized, missing: false, content }];
  const dir = path.dirname(normalized);
  let match;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const ref = match[1];
    let resolved;
    if (ref.startsWith(".")) {
      resolved = path.normalize(path.join(dir, ref));
    } else if (ref.startsWith("@app-tour/design-tokens/")) {
      const rel = ref.slice("@app-tour/design-tokens/".length);
      resolved = path.normalize(path.join(repoRoot, "packages/design-tokens/src", rel));
      if (!fs.existsSync(resolved) && fs.existsSync(`${resolved}.css`)) {
        resolved = `${resolved}.css`;
      }
    } else {
      continue;
    }
    files.push(...readCssImportTree(repoRoot, resolved, visited));
  }
  return files;
}

/** @param {string} content */
export function findBootstrapViolations(content, relPath) {
  /** @type {string[]} */
  const violations = [];
  const rules = [
    { re: /data-workspace-plugin\s*=/, msg: "workspace plugin selector" },
    { re: /\.denali-/, msg: "denali-prefixed class" },
    { re: /\.urban-/, msg: "urban-prefixed class" },
    { re: /\.guest-club-/, msg: "guest-club-prefixed class" },
    { re: /@app-tour\/workspace-/, msg: "workspace package import" },
    { re: /packages\/workspaces\//, msg: "workspace path reference" },
  ];
  for (const { re, msg } of rules) {
    if (re.test(content)) {
      violations.push(`${relPath}: forbidden ${msg}`);
    }
  }
  return violations;
}

/** @param {string} globalsContent */
export function assertGlobalsImportOnly(globalsContent, relPath) {
  /** @type {string[]} */
  const violations = [];
  const lines = globalsContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }
    if (/^@import\s/.test(trimmed)) {
      continue;
    }
    violations.push(`${relPath}: non-import line: ${trimmed}`);
  }
  return violations;
}


/** @param {string} content @param {string} relPath */
export function findL2FallbackViolations(content, relPath) {
  /** @type {string[]} */
  const violations = [];
  const banned = [
    { re: /var\(--(?:primary|foreground|background|border|muted|destructive|card|input)\)/, msg: "semantic color var" },
    { re: /color-mix\(/, msg: "color-mix" },
    { re: /backdrop-filter:/, msg: "backdrop-filter" },
    { re: /box-shadow:/, msg: "box-shadow" },
  ];
  for (const { re, msg } of banned) {
    if (re.test(content)) {
      violations.push(`${relPath}: L2 fallback must not use ${msg}`);
    }
  }
  return violations;
}
