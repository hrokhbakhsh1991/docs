import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
export const API_SRC_ROOT = path.join(REPO_ROOT, "apps/api/src");

/**
 * @param {object} [options]
 * @param {boolean} [options.excludeSpec]
 * @param {boolean} [options.excludeGenerated]
 * @param {RegExp} [options.filePattern]
 * @returns {string[]}
 */
export function walkApiSrcFiles(options = {}) {
  const {
    excludeSpec = true,
    excludeGenerated = true,
    filePattern = /\.(ts|tsx|mts|cts)$/,
  } = options;

  /** @type {string[]} */
  const files = [];

  /**
   * @param {string} dir
   */
  function walk(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "dist") {
          continue;
        }
        walk(abs);
        continue;
      }
      if (!filePattern.test(ent.name)) {
        continue;
      }
      if (excludeSpec && ent.name.endsWith(".spec.ts")) {
        continue;
      }
      if (excludeGenerated && ent.name.endsWith(".generated.ts")) {
        continue;
      }
      files.push(abs);
    }
  }

  walk(API_SRC_ROOT);
  return files;
}

/**
 * @param {string} absPath
 */
export function relFromApiSrc(absPath) {
  return path.relative(API_SRC_ROOT, absPath).replaceAll("\\", "/");
}

/**
 * @param {string} absPath
 */
export function relFromRepo(absPath) {
  return path.relative(REPO_ROOT, absPath).replaceAll("\\", "/");
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function extractImportSpecifiers(source) {
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
