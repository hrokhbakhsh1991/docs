#!/usr/bin/env node
/**
 * PSR-2c — no markdown links from docs/** into ignored scratch.
 *
 * Extends PSR-2b: scans all docs/ files (not only architecture/standards).
 * Still allows prose/backticks; forbids ](...TEMP/...), ](...temp/...),
 * ](...docs/temp/...), and related_temp: frontmatter.
 *
 * Usage: node scripts/ops/psr-2c-no-temp-doc-links.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const DOCS = join(ROOT, "docs");

const LINK_RE =
  /\]\(\s*(?:\.\/|\.\.\/)*(?:[^)\s]*\/)?((?:TEMP|temp|docs\/temp)\/[^)\s]+)\s*\)/g;
const RELATED_RE = /^related_temp:\s*/m;

function fail(msg) {
  console.error(`psr-2c-no-temp-doc-links: FAIL — ${msg}`);
  process.exitCode = 1;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (/\.(md|mdoc|yaml|yml)$/.test(name)) out.push(abs);
  }
  return out;
}

function main() {
  if (!existsSync(DOCS)) {
    fail("docs/ missing");
    process.exit(1);
  }
  const files = walk(DOCS);
  let checked = 0;
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const text = readFileSync(abs, "utf8");
    checked += 1;
    if (RELATED_RE.test(text)) {
      fail(`${rel}: related_temp frontmatter`);
    }
    LINK_RE.lastIndex = 0;
    let m;
    while ((m = LINK_RE.exec(text))) {
      fail(`${rel}: markdown link into ignored scratch → ${m[1]}`);
    }
  }
  if (process.exitCode) {
    console.error("psr-2c-no-temp-doc-links: completed with failures");
    process.exit(process.exitCode);
  }
  console.log(
    `psr-2c-no-temp-doc-links: PASS (${checked} docs files; zero ignored-scratch markdown links)`,
  );
}

main();
