#!/usr/bin/env node
/**
 * Prepends Markdoc frontmatter to a markdown file and writes .mdoc alongside.
 * Usage: node scripts/doc/md-to-mdoc.mjs <docs/relative.md> --title "..." --phase N
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

function parseArgs(argv) {
  const positional = [];
  let title = "";
  let phase = "";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--title") {
      title = argv[i + 1] ?? "";
      i += 1;
    } else if (argv[i] === "--phase") {
      phase = argv[i + 1] ?? "";
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  return { inputRel: positional[0], title, phase };
}

function main() {
  const { inputRel, title, phase } = parseArgs(process.argv.slice(2));
  if (!inputRel) {
    console.error("usage: md-to-mdoc.mjs <docs/foo.md> --title T --phase N");
    process.exit(1);
  }
  const inputPath = path.join(DOCS_DIR, inputRel);
  if (!fs.existsSync(inputPath)) {
    console.error(`missing: ${inputPath}`);
    process.exit(1);
  }
  const body = fs.readFileSync(inputPath, "utf8");
  const base = inputRel.replace(/\.md$/i, "");
  const outputRel = `${base}.mdoc`;
  const outputPath = path.join(DOCS_DIR, outputRel);

  const frontmatter = [
    "---",
    `title: ${title || base}`,
    phase ? `phase: ${phase}` : null,
    `format: markdoc`,
    `sourceMarkdown: ${inputRel}`,
    `convertedAt: ${new Date().toISOString().slice(0, 10)}`,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const normalizedBody = body.startsWith("\n") ? body : `\n${body}`;
  fs.writeFileSync(outputPath, `${frontmatter}${normalizedBody}`);
  console.log(`wrote ${path.relative(REPO_ROOT, outputPath)}`);
}

main();
