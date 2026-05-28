#!/usr/bin/env node
/**
 * Rewrites direct feature-internal imports to the nearest index.ts barrel.
 *
 * Targets ESLint no-restricted-imports violations (features/* internal imports).
 *
 * Usage:
 *   node scripts/fix-barrels.mjs           # dry-run
 *   node scripts/fix-barrels.mjs --write   # apply changes
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");
const WEB_SRC = path.join(WEB_ROOT, "src");
const FEATURES_ROOT = path.join(WEB_SRC, "features");

const WRITE = process.argv.includes("--write");
const RESTRICTED_PATTERN = /\/features\/[^/]+\/.+/;

const IMPORT_FROM_RE = /from\s+["']([^"']+)["']\s*;?\s*$/;
const IMPORT_NAMED_RE =
  /^\s*import\s+(type\s+)?(?:(\*\s+as\s+(\w+))|(?:\{([^}]+)\}|(\w+)))\s+from\s+["']([^"']+)["'];?\s*$/;

function posix(p) {
  return p.split(path.sep).join("/");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
  if (!WRITE) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function resolveModuleFile(specifier, importerPath) {
  const candidates = [];
  if (specifier.startsWith("@/")) {
    const sub = specifier.slice(2);
    const base = path.join(WEB_SRC, sub);
    candidates.push(base);
  } else if (specifier.startsWith(".")) {
    candidates.push(path.resolve(path.dirname(importerPath), specifier));
  } else if (specifier.includes("features/")) {
    const idx = specifier.indexOf("features/");
    candidates.push(path.join(WEB_SRC, specifier.slice(idx)));
    candidates.push(path.join(REPO_ROOT, specifier));
  }

  const exts = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".unified"];
  for (const base of candidates) {
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    for (const ext of exts) {
      const p = base + ext;
      if (fs.existsSync(p)) return p;
    }
    const indexTs = path.join(base, "index.ts");
    if (fs.existsSync(indexTs)) return indexTs;
  }
  return null;
}

function featureRootFor(targetAbsPath) {
  const rel = posix(path.relative(WEB_SRC, targetAbsPath));
  const m = rel.match(/^features\/([^/]+)\//);
  if (!m) return null;
  return path.join(FEATURES_ROOT, m[1]);
}

/**
 * ESLint no-restricted-imports forbids paths like features/NAME/child/...
 * The only valid public entry is features/NAME/index.ts (e.g. @/features/tours).
 */
function findNearestBarrel(targetAbsPath) {
  const featureRoot = featureRootFor(targetAbsPath);
  if (!featureRoot) return null;

  const indexPath = path.join(featureRoot, "index.ts");
  return { barrelDir: featureRoot, indexPath, created: !fs.existsSync(indexPath) };
}

function parseNamedImports(clause) {
  if (!clause) return [];
  return clause
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^type\s+(\w+)(?:\s+as\s+(\w+))?$/);
      if (m) return { name: m[2] ?? m[1], imported: m[1], isType: true };
      const m2 = part.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (m2) return { name: m2[2] ?? m2[1], imported: m2[1], isType: false };
      return null;
    })
    .filter(Boolean);
}

function relativeModuleRef(fromDir, targetModulePath) {
  const rel = path.relative(fromDir, targetModulePath);
  let ref = posix(rel);
  if (!ref.startsWith(".")) ref = `./${ref}`;
  ref = ref.replace(/\.(tsx?|mts|cts|unified)$/, "");
  if (ref.endsWith("/index")) ref = ref.slice(0, -"/index".length);
  return ref;
}

function formatImportPath(importerPath, barrelDir) {
  const relImporter = posix(path.relative(REPO_ROOT, importerPath));
  const useAlias =
    relImporter.startsWith("apps/web/src/") ||
    relImporter.startsWith("apps/web/app/") ||
    relImporter.startsWith("apps/web/tests/") ||
    relImporter.startsWith("apps/web/scripts/");

  if (useAlias) {
    const relBarrel = posix(path.relative(WEB_SRC, barrelDir));
    return `@/${relBarrel}`;
  }
  let rel = posix(path.relative(path.dirname(importerPath), barrelDir));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function ensureBarrelExports(indexPath, targetModulePath, symbols) {
  let content = fs.existsSync(indexPath) ? readText(indexPath) : "";
  const relFromBarrel = relativeModuleRef(path.dirname(indexPath), targetModulePath);
  const valueNames = symbols.filter((s) => !s.isType && !s.isDefault && !s.isNamespace).map((s) => s.imported);
  const typeOnly = symbols.filter((s) => s.isType).map((s) => s.imported);
  const defaultSym = symbols.find((s) => s.isDefault);

  const linesToAdd = [];
  if (defaultSym) {
    const line = `export { default } from "${relFromBarrel}";`;
    if (!content.includes(line)) linesToAdd.push(line);
  }
  if (valueNames.length) {
    const missing = valueNames.filter((n) => !new RegExp(`\\bexport\\s+\\{[^}]*\\b${n}\\b`).test(content));
    if (missing.length) {
      linesToAdd.push(`export { ${missing.join(", ")} } from "${relFromBarrel}";`);
    }
  }
  if (typeOnly.length) {
    const missing = typeOnly.filter((n) => !new RegExp(`\\bexport\\s+type\\s+\\{[^}]*\\b${n}\\b`).test(content));
    if (missing.length) {
      linesToAdd.push(`export type { ${missing.join(", ")} } from "${relFromBarrel}";`);
    }
  }

  if (!linesToAdd.length) return content;

  const header = content.endsWith("\n") || content.length === 0 ? "" : "\n";
  return `${content}${header}${linesToAdd.join("\n")}\n`;
}

function collectViolations() {
  const outFile = path.join(REPO_ROOT, ".tmp-eslint-barrels.json");
  const result = spawnSync(
    "pnpm",
    ["eslint", ".", "-f", "json", "-o", outFile],
    { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (!fs.existsSync(outFile)) {
    console.error("Failed to run eslint:", result.stderr || result.stdout);
    process.exit(1);
  }
  const reports = JSON.parse(readText(outFile));
  const violations = [];
  for (const file of reports) {
    for (const msg of file.messages) {
      if (msg.ruleId !== "no-restricted-imports") continue;
      const m = msg.message.match(/^'([^']+)' import is restricted/);
      if (!m) continue;
      violations.push({
        file: file.filePath,
        line: msg.line,
        specifier: m[1],
      });
    }
  }
  return violations;
}

function extractImportBlock(lines, violationLineIdx) {
  let start = violationLineIdx;
  while (start > 0 && !lines[start].trimStart().startsWith("import")) start -= 1;
  if (!lines[start].trimStart().startsWith("import")) return null;

  let end = start;
  while (end < lines.length && !lines[end].includes(";")) end += 1;
  const block = lines.slice(start, end + 1).join("\n");
  const fromM = block.match(IMPORT_FROM_RE);
  if (!fromM) return null;

  const spec = fromM[1];
  const isTypeOnly = /^import\s+type\s+/m.test(block);
  const nsM = block.match(/import\s+(?:type\s+)?\*\s+as\s+(\w+)/);
  const defM = block.match(/import\s+(?:type\s+)?(\w+)\s+from/);
  const namedM = block.match(/import\s+(?:type\s+)?\{([\s\S]+?)\}\s+from/);

  let symbols = [];
  if (nsM) {
    symbols = [{ name: nsM[1], imported: "*", isType: false, isNamespace: true }];
  } else if (defM && !namedM) {
    symbols = [{ name: defM[1], imported: "default", isType: false, isDefault: true }];
  } else if (namedM) {
    symbols = parseNamedImports(namedM[1].replace(/\s+/g, " ")).map((s) => ({
      ...s,
      isType: s.isType || isTypeOnly,
    }));
  }

  return { start, end, spec, symbols, block };
}

function applyFix(violation) {
  const { file: importerPath, line, specifier } = violation;
  if (!RESTRICTED_PATTERN.test(specifier.replace(/^@\//, "src/"))) return null;

  const lines = readText(importerPath).split("\n");
  const lineIdx = line - 1;

  let parsed = extractImportBlock(lines, lineIdx);
  if (!parsed) {
    const m = lines[lineIdx]?.match(IMPORT_NAMED_RE);
    if (!m) return null;
    const isTypeOnly = Boolean(m[1]);
    parsed = {
      start: lineIdx,
      end: lineIdx,
      spec: m[6],
      symbols: m[3]
        ? [{ name: m[3], imported: "*", isType: false, isNamespace: true }]
        : m[5]
          ? [{ name: m[5], imported: "default", isType: false, isDefault: true }]
          : parseNamedImports(m[4]).map((s) => ({ ...s, isType: s.isType || isTypeOnly })),
      block: lines[lineIdx],
    };
  }

  if (parsed.spec !== specifier) return null;

  const targetModule = resolveModuleFile(specifier, importerPath);
  if (!targetModule) {
    return { error: `Could not resolve module for ${specifier} (${importerPath}:${line})` };
  }

  const barrel = findNearestBarrel(targetModule);
  if (!barrel) return { error: `No feature root for ${targetModule}` };

  const newBarrelContent = ensureBarrelExports(barrel.indexPath, targetModule, parsed.symbols);
  const newSpec = formatImportPath(importerPath, barrel.barrelDir);
  const newBlock = parsed.block.replace(
    /from\s+["'][^"']+["']/,
    `from "${newSpec}"`,
  );

  return {
    importerPath,
    start: parsed.start,
    end: parsed.end,
    newBlock,
    barrel,
    newBarrelContent,
    oldSpec: specifier,
    newSpec,
  };
}

function main() {
  const violations = collectViolations();
  console.log(`Found ${violations.length} barrel-only (no-restricted-imports) violations`);
  if (!violations.length) return;

  const barrelEdits = new Map();
  const fileLineEdits = new Map();
  const errors = [];

  for (const v of violations) {
    const fix = applyFix(v);
    if (!fix) continue;
    if (fix.error) {
      errors.push(fix.error);
      continue;
    }
    if (!fileLineEdits.has(fix.importerPath)) fileLineEdits.set(fix.importerPath, []);
    fileLineEdits.get(fix.importerPath).push(fix);
    barrelEdits.set(fix.barrel.indexPath, fix.newBarrelContent);
    console.log(
      `${WRITE ? "fix" : "plan"}: ${posix(path.relative(REPO_ROOT, fix.importerPath))}:${fix.start + 1}`,
    );
    console.log(`  ${fix.oldSpec} → ${fix.newSpec}`);
  }

  if (errors.length) {
    console.error("\nErrors:");
    for (const e of errors) console.error(`  - ${e}`);
  }

  if (!WRITE) {
    console.log(`\nDry run: ${fileLineEdits.size} files, ${barrelEdits.size} barrels. Pass --write to apply.`);
    return;
  }

  for (const [indexPath, content] of barrelEdits) {
    writeText(indexPath, content);
  }
  for (const [importerPath, fixes] of fileLineEdits) {
    const lines = readText(importerPath).split("\n");
    const ordered = [...fixes].sort((a, b) => b.start - a.start);
    for (const fix of ordered) {
      const replacement = fix.newBlock.split("\n");
      lines.splice(fix.start, fix.end - fix.start + 1, ...replacement);
    }
    writeText(importerPath, lines.join("\n"));
  }

  const after = collectViolations();
  console.log(`\nApplied. Remaining barrel violations: ${after.length}`);
}

main();
