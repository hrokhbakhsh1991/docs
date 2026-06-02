#!/usr/bin/env node
/**
 * Fix ESLint no-unused-vars / @typescript-eslint/no-unused-vars across the repo.
 *
 *   node scripts/remove-unused-vars.mjs           # dry-run
 *   node scripts/remove-unused-vars.mjs --write   # apply
 *
 * Strategy:
 *   - Parameters / catch bindings → prefix with _
 *   - Unused locals with side-effect init → void expression statement
 *   - Other unused locals → remove declaration statement
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const WRITE = process.argv.includes("--write");

const requireFromWeb = createRequire(path.join(REPO_ROOT, "apps/web/package.json"));
const ts = requireFromWeb("typescript");

const UNUSED_RULES = new Set(["no-unused-vars", "@typescript-eslint/no-unused-vars"]);

function scriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function collectViolations() {
  const outFile = path.join(REPO_ROOT, ".tmp-eslint-unused-vars.json");
  spawnSync("pnpm", ["eslint", ".", "-f", "json", "-o", outFile], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (!fs.existsSync(outFile)) {
    throw new Error("eslint JSON output missing");
  }
  const reports = JSON.parse(fs.readFileSync(outFile, "utf8"));
  const seen = new Set();
  const list = [];
  for (const file of reports) {
    for (const msg of file.messages) {
      if (!UNUSED_RULES.has(msg.ruleId)) continue;
      const nameMatch = msg.message.match(/^'([^']+)'/);
      if (!nameMatch) continue;
      const key = `${file.filePath}:${msg.line}:${msg.column}:${nameMatch[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        filePath: file.filePath,
        line: msg.line,
        column: msg.column,
        name: nameMatch[1],
        isArg: msg.message.includes("Allowed unused args"),
        isAssigned: msg.message.includes("assigned a value but never used"),
      });
    }
  }
  return list;
}

function hasSideEffectInitializer(expr) {
  if (!expr) return false;
  if (ts.isCallExpression(expr) || ts.isNewExpression(expr) || ts.isAwaitExpression(expr)) {
    return true;
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    return true;
  }
  if (ts.isIdentifier(expr) && expr.text === "undefined") return false;
  return false;
}

function findBindingIdentifier(sf, violation) {
  const pos = sf.getPositionOfLineAndCharacter(violation.line - 1, violation.column - 1);
  let node = ts.getTokenAtPosition(sf, pos);
  while (node) {
    if (ts.isIdentifier(node) && node.text === violation.name) return node;
    if (ts.isPrivateIdentifier(node) && node.text === violation.name) return node;
    node = node.parent;
  }
  return undefined;
}

function renameIdentifier(sourceFile, identifier, newName) {
  const changes = [];
  const rename = (id) => {
    changes.push({
      start: id.getStart(sourceFile),
      end: id.getEnd(),
      text: newName,
    });
  };
  rename(identifier);
  return changes;
}

function removeNode(sourceFile, node) {
  let target = node;
  if (ts.isVariableDeclaration(node) && ts.isVariableStatement(node.parent)) {
    target = node.parent;
    if (target.parent && ts.isForOfStatement(target.parent)) {
      return null;
    }
  }
  const start = target.getFullStart();
  let end = target.getEnd();
  if (sourceFile.text[end] === ";") end += 1;
  if (sourceFile.text[end] === "\r") end += 1;
  if (sourceFile.text[end] === "\n") end += 1;
  return [{ start, end, text: "" }];
}

function voidifyStatement(sourceFile, statement) {
  const decl = statement.declarationList.declarations[0];
  const expr = decl.initializer;
  if (!expr) return removeNode(sourceFile, statement);
  const start = statement.getStart(sourceFile);
  let end = statement.getEnd();
  if (sourceFile.text[end] === ";") end += 1;
  const text = `void ${expr.getText(sourceFile)};\n`;
  return [{ start, end, text }];
}

function applyChanges(filePath, changes) {
  if (!changes.length) return false;
  const original = fs.readFileSync(filePath, "utf8");
  const sorted = [...changes].sort((a, b) => b.start - a.start);
  let text = original;
  for (const c of sorted) {
    text = text.slice(0, c.start) + c.text + text.slice(c.end);
  }
  if (text === original) return false;
  if (WRITE) fs.writeFileSync(filePath, text, "utf8");
  return true;
}

function fixViolation(sourceFile, violation) {
  const id = findBindingIdentifier(sourceFile, violation);
  if (!id) return [];

  const parent = id.parent;
  if (ts.isBindingElement(parent) && ts.isObjectBindingPattern(parent.parent)) {
    const param = parent.parent.parent;
    if (ts.isParameter(param)) {
      return [];
    }
  }

  if (violation.isArg || ts.isParameter(parent) || ts.isCatchClause(parent)) {
    const prefixed = violation.name.startsWith("_") ? violation.name : `_${violation.name}`;
    if (id.text === prefixed) return [];
    return renameIdentifier(sourceFile, id, prefixed);
  }

  if (ts.isVariableDeclaration(parent) && parent.name === id) {
    const stmt = parent.parent && ts.isVariableStatement(parent.parent) ? parent.parent : null;
    if (stmt && stmt.declarationList.declarations.length === 1) {
      if (hasSideEffectInitializer(parent.initializer)) {
        return voidifyStatement(sourceFile, stmt);
      }
      return removeNode(sourceFile, parent);
    }
    const prefixed = violation.name.startsWith("_") ? violation.name : `_${violation.name}`;
    return renameIdentifier(sourceFile, id, prefixed);
  }

  if (ts.isBindingElement(parent)) {
    const prefixed = violation.name.startsWith("_") ? violation.name : `_${violation.name}`;
    return renameIdentifier(sourceFile, id, prefixed);
  }

  const prefixed = violation.name.startsWith("_") ? violation.name : `_${violation.name}`;
  return renameIdentifier(sourceFile, id, prefixed);
}

function fixFile(filePath, violations) {
  const text = fs.readFileSync(filePath, "utf8");
  const _sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );

  const ordered = [...violations].sort((a, b) => b.line - a.line || b.column - a.column);
  const allChanges = [];
  for (const v of ordered) {
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : text;
    const currentSf = ts.createSourceFile(filePath, current, ts.ScriptTarget.Latest, true, scriptKind(filePath));
    const changes = fixViolation(currentSf, v);
    if (changes?.length) {
      allChanges.push(...changes);
      if (WRITE) applyChanges(filePath, changes);
    }
  }
  return allChanges.length;
}

function main() {
  const violations = collectViolations();
  console.log(`Found ${violations.length} unique no-unused-vars violations`);

  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.filePath)) byFile.set(v.filePath, []);
    byFile.get(v.filePath).push(v);
  }

  let fixedFiles = 0;
  let unresolved = [];

  for (const [filePath, fileViolations] of byFile) {
    try {
      const n = fixFile(filePath, fileViolations);
      if (n > 0) {
        fixedFiles += 1;
        console.log(`${WRITE ? "fixed" : "plan"}: ${path.relative(REPO_ROOT, filePath)} (${fileViolations.length})`);
      }
    } catch (err) {
      unresolved.push({ filePath, err: String(err) });
    }
  }

  if (unresolved.length) {
    console.error("\nErrors:");
    for (const u of unresolved) console.error(`  ${u.filePath}: ${u.err}`);
  }

  if (!WRITE) {
    console.log(`\nDry run: ${fixedFiles} files. Pass --write to apply.`);
    return;
  }

  const after = collectViolations();
  console.log(`\nApplied. Remaining unique no-unused-vars: ${after.length}`);
  if (after.length) {
    for (const v of after.slice(0, 20)) {
      console.log(`  ${path.relative(REPO_ROOT, v.filePath)}:${v.line} ${v.name}`);
    }
    if (after.length > 20) console.log(`  ... and ${after.length - 20} more`);
  }
}

main();
