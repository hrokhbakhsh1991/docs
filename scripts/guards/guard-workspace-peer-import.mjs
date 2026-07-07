#!/usr/bin/env node
/**
 * Forbid peer-to-peer workspace package imports (denali → urban, etc.).
 * @see docs/dev/ci-defensive-guards.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_ROOT = path.join(REPO_ROOT, "packages/workspaces");

const WORKSPACE_PKG_RE = /^@app-tour\/workspace-[a-z0-9-]+$/;
const ALLOWED_PEER = new Set(["@app-tour/workspace-sdk"]);

/** @type {string[]} */
const violations = [];

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkSourceFiles(dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") {
        continue;
      }
      files.push(...walkSourceFiles(abs));
      continue;
    }
    if (/\.(ts|tsx|mts|cts)$/.test(ent.name)) {
      files.push(abs);
    }
  }
  return files;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
function extractWorkspaceImports(source) {
  /** @type {string[]} */
  const specifiers = [];
  const staticImport = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(staticImport)) {
    specifiers.push(match[1]);
  }
  const dynamicImport = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(dynamicImport)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

if (!fs.existsSync(WORKSPACES_ROOT)) {
  console.error("guard-workspace-peer-import: FAIL — packages/workspaces missing");
  process.exit(1);
}

for (const workspaceId of fs.readdirSync(WORKSPACES_ROOT).sort()) {
  const workspaceDir = path.join(WORKSPACES_ROOT, workspaceId);
  if (!fs.statSync(workspaceDir).isDirectory()) {
    continue;
  }
  const pkgJsonPath = path.join(workspaceDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    continue;
  }
  const ownPackage = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")).name;
  if (typeof ownPackage !== "string") {
    continue;
  }

  for (const relRoot of ["src", "test", "host"]) {
    const scanRoot = path.join(workspaceDir, relRoot);
    for (const file of walkSourceFiles(scanRoot)) {
      const rel = path.relative(REPO_ROOT, file).replaceAll("\\", "/");
      const source = fs.readFileSync(file, "utf8");
      for (const specifier of extractWorkspaceImports(source)) {
        if (!WORKSPACE_PKG_RE.test(specifier)) {
          continue;
        }
        if (ALLOWED_PEER.has(specifier) || specifier === ownPackage) {
          continue;
        }
        violations.push(`${rel}: forbidden peer import ${specifier} (own package: ${ownPackage})`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-workspace-peer-import: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard-workspace-peer-import: PASS");
