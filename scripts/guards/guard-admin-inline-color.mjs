#!/usr/bin/env node
/**
 * Ban raw hex / palette colors in apps/web TSX and CSS outside generated loaders.
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F7
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SCAN_ROOTS = [
  path.join(REPO_ROOT, "apps/web/src"),
  path.join(REPO_ROOT, "apps/web/app"),
];

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".next"]);

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_RE = /\brgb\s*\(/;
const HSL_RE = /\bhsl\s*\(/;
const ARBITRARY_HEX_RE = /\[#[0-9a-fA-F]{3,8}\]/;
const PALETTE_COLOR_RE =
  /(?:^|\s)(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+(?:\/\d+)?)?/;

/**
 * @param {string} filePath
 */
function isAllowlistedFile(filePath) {
  const base = path.basename(filePath);
  if (base.endsWith(".generated.ts") || base.endsWith(".generated.tsx")) {
    return true;
  }
  if (filePath.includes(`${path.sep}bootstrap${path.sep}`)) {
    return true;
  }
  if (filePath.includes(`${path.sep}admin${path.sep}`)) {
    return true;
  }
  return false;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) {
        continue;
      }
      files.push(...walkFiles(abs));
      continue;
    }
    if (/\.(tsx|css)$/.test(ent.name)) {
      files.push(abs);
    }
  }
  return files;
}

/** @type {string[]} */
const violations = [];

for (const root of SCAN_ROOTS) {
  for (const file of walkFiles(root)) {
    if (isAllowlistedFile(file)) {
      continue;
    }
    const rel = path.relative(REPO_ROOT, file).replaceAll("\\", "/");
    const source = fs.readFileSync(file, "utf8");
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }
      if (file.endsWith(".css") && HEX_RE.test(line)) {
        violations.push(`${rel}:${i + 1}: raw hex in CSS`);
        continue;
      }
      if (file.endsWith(".tsx")) {
        if (ARBITRARY_HEX_RE.test(line)) {
          violations.push(`${rel}:${i + 1}: arbitrary hex in className`);
        } else if (PALETTE_COLOR_RE.test(line)) {
          violations.push(`${rel}:${i + 1}: Tailwind palette color (use semantic token)`);
        } else if (HEX_RE.test(line) || RGB_RE.test(line) || HSL_RE.test(line)) {
          violations.push(`${rel}:${i + 1}: inline raw color literal`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-admin-inline-color: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard-admin-inline-color: PASS");
