#!/usr/bin/env node
/**
 * Parse all Markdoc audit files under docs/ using docs/markdoc/config.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

async function loadMarkdoc() {
  const mod = await import("@markdoc/markdoc");
  return mod.default ?? mod;
}

async function loadConfig() {
  const configPath = path.join(DOCS_DIR, "markdoc/config.mjs");
  const url = pathToFileURL(configPath).href;
  const mod = await import(url);
  return mod.default ?? mod;
}

function collectMdocFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMdocFiles(full));
    } else if (entry.name.endsWith(".mdoc")) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const Markdoc = await loadMarkdoc();
  const config = await loadConfig();
  const files = collectMdocFiles(DOCS_DIR);

  if (files.length === 0) {
    console.error("doc:markdoc:validate: no .mdoc files under docs/");
    process.exit(1);
  }

  let failed = 0;
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    const source = fs.readFileSync(file, "utf8");
    try {
      const ast = Markdoc.parse(source);
      Markdoc.transform(ast, config);
      console.log(`  ✓ ${rel}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ ${rel}: ${message}`);
    }
  }

  if (failed > 0) {
    console.error(`doc:markdoc:validate: FAIL (${failed} file(s))`);
    process.exit(1);
  }
  console.log(`doc:markdoc:validate: PASS (${files.length} file(s))`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
