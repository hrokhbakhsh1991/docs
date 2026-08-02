#!/usr/bin/env node
/**
 * Thin shell guard — apps/web must not statically import product workspace packages
 * outside generated loaders (Build-time Capability Host registries).
 * @see docs/dev/wave-i-3-thin-shell-guard.mdoc
 * @see docs/dev/thin-shell-generated-bootstrap-inventory.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = [
  path.join(REPO_ROOT, "apps/web/src"),
  path.join(REPO_ROOT, "apps/web/app"),
];
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIR = new Set(["node_modules", "dist", ".next", "coverage"]);

/** Product workspace package scope — sdk is allowed. */
const PRODUCT_PKG = /@app-cloud\/workspace-([a-z0-9-]+)/g;

/**
 * Accepted Build-time Capability Host generated files that may only use
 * dynamic import() for product packages (no static `from` product imports).
 */
const DYNAMIC_ONLY_GENERATED = new Set([
  "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts",
  "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts",
  "apps/web/src/bootstrap/workspace-wizard-message-loads.generated.ts",
  "apps/web/src/bootstrap/workspace-owner-settings-panel-loaders.generated.ts",
]);

/**
 * Generated static product import line budget.
 * Decrease when binders become dynamic-only; never raise without charter edit.
 */
const MAX_STATIC_GENERATED_PRODUCT_IMPORTS = 0;

/** @type {string[]} */
const hits = [];
/** @type {string[]} */
const staticGeneratedHits = [];
/** Hard fail: branded firewall path must stay deleted. */
const FORBIDDEN_SHELL_PATHS = ["apps/web/src/wizard/denali"];

/**
 * @param {string} line
 * @returns {boolean}
 */
function lineHasProductWorkspaceImport(line) {
  PRODUCT_PKG.lastIndex = 0;
  let match;
  while ((match = PRODUCT_PKG.exec(line)) !== null) {
    if (match[1] !== "sdk") {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function lineHasStaticProductImport(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return false;
  }
  if (!lineHasProductWorkspaceImport(line)) {
    return false;
  }
  // Dynamic import() is allowed in loaders.
  if (/import\s*\(\s*['"`]@app-cloud\/workspace-/.test(line)) {
    return false;
  }
  return /(?:import|export)\s/.test(line) && /from\s+['"`]@app-cloud\/workspace-/.test(line);
}

/**
 * @param {string} absDir
 * @param {string} relDir
 */
function walk(absDir, relDir) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (SKIP_DIR.has(ent.name)) continue;
    const abs = path.join(absDir, ent.name);
    const rel = path.join(relDir, ent.name);
    const relPosix = rel.split(path.sep).join("/");
    if (ent.isDirectory()) {
      walk(abs, rel);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!EXT.has(path.extname(ent.name))) continue;

    const text = fs.readFileSync(abs, "utf8");
    const isGenerated = relPosix.includes(".generated.");
    if (!text.includes("@app-tour/workspace-")) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!lineHasProductWorkspaceImport(line)) continue;
      if (isGenerated) {
        if (lineHasStaticProductImport(line)) {
          staticGeneratedHits.push(`${relPosix}:${i + 1}:${line.trim().slice(0, 120)}`);
          if (DYNAMIC_ONLY_GENERATED.has(relPosix)) {
            hits.push(
              `${relPosix}:${i + 1}: dynamic-only generated file must not static-import product packages`
            );
          }
        }
        continue;
      }
      hits.push(`${relPosix}:${i + 1}:${line.trim().slice(0, 160)}`);
    }
  }
}

for (const forbidden of FORBIDDEN_SHELL_PATHS) {
  const abs = path.join(REPO_ROOT, forbidden);
  if (fs.existsSync(abs)) {
    hits.push(`${forbidden}: directory must not exist (product firewall removed — use generated loaders)`);
  }
}

for (const absRoot of ROOTS) {
  const relRoot = path.relative(REPO_ROOT, absRoot);
  walk(absRoot, relRoot);
}

if (hits.length > 0) {
  console.error("guard-thin-shell: FAIL — product workspace imports outside allowlist");
  console.error("Allowed: @app-tour/workspace-sdk; *.generated.* (metered)");
  console.error("See docs/dev/thin-shell-generated-bootstrap-inventory.mdoc");
  for (const h of hits.slice(0, 40)) {
    console.error(` - ${h}`);
  }
  if (hits.length > 40) console.error(` … +${hits.length - 40} more`);
  process.exit(1);
}

const staticCount = staticGeneratedHits.length;
if (staticCount > MAX_STATIC_GENERATED_PRODUCT_IMPORTS) {
  console.error("guard-thin-shell: FAIL — generated static product imports exceeded budget");
  console.error(
    `  staticLines=${staticCount} budget=${MAX_STATIC_GENERATED_PRODUCT_IMPORTS} (decrease via dynamic-only codegen)`
  );
  console.error("  See docs/dev/thin-shell-generated-bootstrap-inventory.mdoc");
  for (const h of staticGeneratedHits.slice(0, 40)) {
    console.error(` - ${h}`);
  }
  if (staticGeneratedHits.length > 40) {
    console.error(` … +${staticGeneratedHits.length - 40} more`);
  }
  process.exit(1);
}

console.log(
  `guard-thin-shell: PASS (non-generated product imports=0; generated static product import lines=${staticCount}/${MAX_STATIC_GENERATED_PRODUCT_IMPORTS})`
);
console.log(
  "guard-thin-shell: NOTE — accepted Build-time registries (dynamic product import only):",
  [...DYNAMIC_ONLY_GENERATED].join(", ")
);
